import { useState } from "react";
import {
  useListVms,
  useCreateVm,
  useUpdateVm,
  useDeleteVm,
  useListPcrs,
  useCreatePcr,
  useUpdatePcr,
  useDeletePcr,
  getListVmsQueryKey,
  getListPcrsQueryKey,
  updateVm as updateVmApi,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, GripVertical, Tv2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tab = "systems" | "rooms";

export function ConfigPage() {
  const [tab, setTab] = useState<Tab>("systems");

  return (
    <div className="flex flex-col h-full bg-background p-6">
      <div className="max-w-4xl mx-auto w-full">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
            <p className="text-muted-foreground mt-1">Manage systems and production control rooms.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6">
          <button
            onClick={() => setTab("systems")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === "systems"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Systems
          </button>
          <button
            onClick={() => setTab("rooms")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === "rooms"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Rooms (PCR)
          </button>
        </div>

        {tab === "systems" ? <SystemsTab /> : <RoomsTab />}
      </div>
    </div>
  );
}

function SystemsTab() {
  const { data: vms, isLoading } = useListVms();
  const { data: pcrs } = useListPcrs();
  const createVm = useCreateVm();
  const updateVm = useUpdateVm();
  const deleteVm = useDeleteVm();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const blankForm = { name: "", url: "", phoneNumber: "", position: 0, pcrId: null as number | null };
  const [formData, setFormData] = useState(blankForm);

  const handleEdit = (vm: any) => {
    setFormData({
      name: vm.name,
      url: vm.url,
      phoneNumber: vm.phoneNumber || "",
      position: vm.position,
      pcrId: vm.pcrId ?? null,
    });
    setIsEditing(vm.id);
  };

  const handleAdd = () => {
    setFormData({ ...blankForm, position: (vms?.length || 0) + 1 });
    setIsAdding(true);
  };

  const handleSave = () => {
    const payload = {
      ...formData,
      pcrId: formData.pcrId ?? null,
    };
    if (isEditing) {
      updateVm.mutate(
        { id: isEditing, data: payload },
        {
          onSuccess: () => {
            setIsEditing(null);
            queryClient.invalidateQueries({ queryKey: getListVmsQueryKey() });
          },
        }
      );
    } else {
      createVm.mutate(
        { data: { ...payload, position: payload.position || (vms?.length || 0) + 1 } },
        {
          onSuccess: () => {
            setIsAdding(false);
            queryClient.invalidateQueries({ queryKey: getListVmsQueryKey() });
          },
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this VM?")) {
      deleteVm.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListVmsQueryKey() });
          },
        }
      );
    }
  };

  if (isLoading) return null;

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add System
        </Button>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {vms?.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No systems configured yet. Add your first system to begin.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {vms?.sort((a, b) => a.position - b.position).map((vm) => {
              const assignedPcr = pcrs?.find((p) => p.id === vm.pcrId);
              return (
                <div key={vm.id} className="flex items-center p-4 hover:bg-muted/50 transition-colors">
                  <div className="mr-4 text-muted-foreground/50">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3 font-semibold">{vm.name}</div>
                    <div className="col-span-4 text-muted-foreground font-mono text-sm truncate">{vm.url}</div>
                    <div className="col-span-2 text-muted-foreground text-sm">{vm.phoneNumber || "—"}</div>
                    <div className="col-span-3 text-sm">
                      {assignedPcr ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                          <Tv2 className="w-3 h-3" />
                          {assignedPcr.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">Unassigned</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(vm)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(vm.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={isAdding || isEditing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setIsAdding(false);
            setIsEditing(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit System" : "Add New System"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. ViP 101"
              />
            </div>
            <div className="space-y-2">
              <Label>Stream URL</Label>
              <Input
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="http://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number (Optional)</Label>
              <Input
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="Ext / Number"
              />
            </div>
            <div className="space-y-2">
              <Label>Room (PCR)</Label>
              <Select
                value={formData.pcrId?.toString() ?? "none"}
                onValueChange={(v) =>
                  setFormData({ ...formData, pcrId: v === "none" ? null : Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {pcrs?.map((pcr) => (
                    <SelectItem key={pcr.id} value={pcr.id.toString()}>
                      {pcr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAdding(false);
                setIsEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave}>{isEditing ? "Save Changes" : "Create System"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RoomsTab() {
  const { data: pcrs, isLoading } = useListPcrs();
  const { data: vms } = useListVms();
  const createPcr = useCreatePcr();
  const updatePcr = useUpdatePcr();
  const deletePcr = useDeletePcr();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [pcrName, setPcrName] = useState("");

  // Assign dialog state
  const [assigningPcr, setAssigningPcr] = useState<{ id: number; name: string } | null>(null);
  const [selectedVmIds, setSelectedVmIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const openAssign = (pcr: { id: number; name: string }) => {
    const alreadyAssigned = new Set(
      (vms ?? []).filter((v) => v.pcrId === pcr.id).map((v) => v.id)
    );
    setSelectedVmIds(alreadyAssigned);
    setAssigningPcr(pcr);
  };

  const toggleVm = (vmId: number) => {
    setSelectedVmIds((prev) => {
      const next = new Set(prev);
      if (next.has(vmId)) next.delete(vmId);
      else next.add(vmId);
      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (!assigningPcr || !vms) return;
    setIsSaving(true);

    const updates: Promise<unknown>[] = [];
    for (const vm of vms) {
      const wasAssigned = vm.pcrId === assigningPcr.id;
      const willBeAssigned = selectedVmIds.has(vm.id);
      if (wasAssigned === willBeAssigned) continue;
      updates.push(
        updateVmApi(vm.id, { pcrId: willBeAssigned ? assigningPcr.id : null })
      );
    }

    await Promise.all(updates);
    await queryClient.invalidateQueries({ queryKey: getListVmsQueryKey() });
    setIsSaving(false);
    setAssigningPcr(null);
  };

  const handleEdit = (pcr: any) => {
    setPcrName(pcr.name);
    setIsEditing(pcr.id);
  };

  const handleSave = () => {
    const name = pcrName.trim();
    if (!name) return;
    if (isEditing) {
      updatePcr.mutate(
        { id: isEditing, data: { name } },
        {
          onSuccess: () => {
            setIsEditing(null);
            queryClient.invalidateQueries({ queryKey: getListPcrsQueryKey() });
          },
        }
      );
    } else {
      createPcr.mutate(
        { data: { name } },
        {
          onSuccess: () => {
            setIsAdding(false);
            setPcrName("");
            queryClient.invalidateQueries({ queryKey: getListPcrsQueryKey() });
          },
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this room? VMs assigned to it will become unassigned, but won't be deleted.")) {
      deletePcr.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPcrsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListVmsQueryKey() });
          },
        }
      );
    }
  };

  if (isLoading) return null;

  const sortedVms = (vms ?? []).slice().sort((a, b) => a.position - b.position);

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setPcrName(""); setIsAdding(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Room
        </Button>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {pcrs?.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No rooms configured yet. Create a PCR room to organize your systems.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pcrs?.map((pcr) => {
              const assigned = (vms ?? []).filter((v) => v.pcrId === pcr.id);
              return (
                <div key={pcr.id} className="flex items-center p-4 hover:bg-muted/50 transition-colors">
                  <Tv2 className="w-5 h-5 text-muted-foreground mr-4 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold">{pcr.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {assigned.length > 0
                        ? assigned.map((v) => v.name).join(", ")
                        : "No systems assigned"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => openAssign(pcr)}
                    >
                      Assign Systems
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(pcr)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(pcr.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign Systems dialog */}
      <Dialog open={assigningPcr !== null} onOpenChange={(o) => { if (!o) setAssigningPcr(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Assign Systems — {assigningPcr?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2 max-h-[60vh] overflow-y-auto">
            {sortedVms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No systems configured yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {sortedVms.map((vm) => {
                  const checked = selectedVmIds.has(vm.id);
                  const otherPcr = vm.pcrId !== null && vm.pcrId !== assigningPcr?.id
                    ? pcrs?.find((p) => p.id === vm.pcrId)
                    : null;
                  return (
                    <label
                      key={vm.id}
                      className="flex items-center gap-3 px-2 py-3 hover:bg-muted/40 rounded-md cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleVm(vm.id)}
                        className="w-4 h-4 accent-primary shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{vm.name}</div>
                        {vm.phoneNumber && (
                          <div className="text-xs text-muted-foreground">{vm.phoneNumber}</div>
                        )}
                      </div>
                      {otherPcr && (
                        <span className="text-xs text-muted-foreground/60 shrink-0">
                          currently in {otherPcr.name}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningPcr(null)}>Cancel</Button>
            <Button onClick={handleSaveAssignments} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / rename room dialog */}
      <Dialog
        open={isAdding || isEditing !== null}
        onOpenChange={(o) => { if (!o) { setIsAdding(false); setIsEditing(null); } }}
      >
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Rename Room" : "Add New Room"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Room Name</Label>
              <Input
                value={pcrName}
                onChange={(e) => setPcrName(e.target.value)}
                placeholder="e.g. PCR 1, Studio A"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAdding(false); setIsEditing(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!pcrName.trim()}>
              {isEditing ? "Save" : "Create Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
