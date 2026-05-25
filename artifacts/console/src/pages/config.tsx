import { useState } from "react";
import { useListVms, useCreateVm, useUpdateVm, useDeleteVm } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListVmsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function ConfigPage() {
  const { data: vms, isLoading } = useListVms();
  const createVm = useCreateVm();
  const updateVm = useUpdateVm();
  const deleteVm = useDeleteVm();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    url: "",
    phoneNumber: "",
    position: 0
  });

  const handleEdit = (vm: any) => {
    setFormData({
      name: vm.name,
      url: vm.url,
      phoneNumber: vm.phoneNumber || "",
      position: vm.position
    });
    setIsEditing(vm.id);
  };

  const handleSave = () => {
    if (isEditing) {
      updateVm.mutate({ id: isEditing, data: formData }, {
        onSuccess: () => {
          setIsEditing(null);
          queryClient.invalidateQueries({ queryKey: getListVmsQueryKey() });
        }
      });
    } else {
      createVm.mutate({ data: formData }, {
        onSuccess: () => {
          setIsAdding(false);
          queryClient.invalidateQueries({ queryKey: getListVmsQueryKey() });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this VM?")) {
      deleteVm.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVmsQueryKey() });
        }
      });
    }
  };

  if (isLoading) return null;

  return (
    <div className="flex flex-col h-full bg-background p-6">
      <div className="flex items-center justify-between mb-8 max-w-4xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">VM Configuration</h1>
          <p className="text-muted-foreground mt-1">Manage Dante Virtual Machines and endpoints.</p>
        </div>
        <Button onClick={() => {
          setFormData({ name: "", url: "", phoneNumber: "", position: (vms?.length || 0) + 1 });
          setIsAdding(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Add System
        </Button>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          {vms?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No VMs configured yet. Add your first system to begin.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {vms?.sort((a, b) => a.position - b.position).map((vm) => (
                <div key={vm.id} className="flex items-center p-4 hover:bg-muted/50 transition-colors">
                  <div className="mr-4 text-muted-foreground/50">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="flex-1 grid grid-cols-12 gap-4">
                    <div className="col-span-3 font-semibold">{vm.name}</div>
                    <div className="col-span-6 text-muted-foreground font-mono text-sm truncate">{vm.url}</div>
                    <div className="col-span-3 text-muted-foreground text-sm">{vm.phoneNumber || '-'}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(vm)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(vm.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isAdding || isEditing !== null} onOpenChange={(o) => { if (!o) { setIsAdding(false); setIsEditing(null); } }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit System' : 'Add New System'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. ViP 101" />
            </div>
            <div className="space-y-2">
              <Label>Stream URL</Label>
              <Input value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="http://..." />
            </div>
            <div className="space-y-2">
              <Label>Phone Number (Optional)</Label>
              <Input value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} placeholder="Ext / Number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAdding(false); setIsEditing(null); }}>Cancel</Button>
            <Button onClick={handleSave}>{isEditing ? 'Save Changes' : 'Create System'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
