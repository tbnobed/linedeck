import { useState, useEffect, useRef } from 'react';
import type { Line } from '@workspace/api-client-react/src/generated/api.schemas';

type SyncStatus = 'SYNCED' | 'OFFLINE' | 'LOCAL';

interface SSEState {
  lines: Record<string, Line>;
  status: SyncStatus;
}

export function useSSE() {
  const [state, setState] = useState<SSEState>({
    lines: {},
    status: 'LOCAL',
  });
  
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!window.EventSource) {
      setState(s => ({ ...s, status: 'LOCAL' }));
      return;
    }

    const connect = () => {
      const es = new EventSource('/api/events');
      eventSourceRef.current = es;

      es.onopen = () => {
        setState(s => ({ ...s, status: 'SYNCED' }));
      };

      es.addEventListener('snapshot', (e) => {
        try {
          const data = JSON.parse(e.data);
          setState(s => ({ ...s, lines: data }));
        } catch (err) {
          console.error('Failed to parse snapshot', err);
        }
      });

      es.addEventListener('data', (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'line') {
            setState(s => ({
              ...s,
              lines: {
                ...s.lines,
                [event.id]: {
                  id: event.id,
                  state: event.state,
                  label: event.label,
                  updatedAt: event.updatedAt
                }
              }
            }));
          } else if (event.type === 'reset') {
            setState(s => {
              const newLines = { ...s.lines };
              for (const id in newLines) {
                newLines[id] = { ...newLines[id], state: 'idle', label: '' };
              }
              return { ...s, lines: newLines };
            });
          }
        } catch (err) {
          console.error('Failed to parse data event', err);
        }
      });

      es.onerror = () => {
        setState(s => ({ ...s, status: 'OFFLINE' }));
        es.close();
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const updateLineLocal = (lineId: string, updates: Partial<Line>) => {
    setState(s => ({
      ...s,
      lines: {
        ...s.lines,
        [lineId]: {
          ...s.lines[lineId],
          ...updates,
          id: lineId,
          updatedAt: new Date().toISOString()
        }
      }
    }));
  };

  return { ...state, updateLineLocal };
}
