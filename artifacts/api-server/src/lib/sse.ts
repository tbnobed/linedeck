type Subscriber = (event: object) => void;

const subscribers = new Set<Subscriber>();

export function addSubscriber(fn: Subscriber): void {
  subscribers.add(fn);
}

export function removeSubscriber(fn: Subscriber): void {
  subscribers.delete(fn);
}

export function broadcast(event: object): void {
  for (const fn of subscribers) {
    try {
      fn(event);
    } catch {
      subscribers.delete(fn);
    }
  }
}

export function subscriberCount(): number {
  return subscribers.size;
}
