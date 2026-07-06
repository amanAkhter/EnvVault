import { EnvVariable, Project } from '../../../types';
import { useEnvStore } from '../store/envStore';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../../components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Copy, Eye, EyeOff, Trash2, ArrowUp, ArrowDown, Plus, Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';
import { useAuthStore } from '../../auth/store/authStore';
import { parseEnvString } from '../utils/envParser';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-hot-toast';

export const EnvEditor = ({ env, search, project }: { env: 'development' | 'production', search: string, project: Project }) => {
  const variables = useEnvStore((state) => state[env]);
  const { addVariable, updateVariable, deleteVariable, reorderVariable, importVariables } = useEnvStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, can } = useAuthStore();
  const canCreate = can('variables.create');
  const canUpdate = can('variables.update');
  const canDelete = can('variables.delete');
  const canReveal = can('variables.reveal');
  const canExport = can('variables.export');
  const canImport = can('imports.run');

  // Import merge strategy modal state
  const [isOpen, setIsOpen] = useState(false);
  const [pendingVars, setPendingVars] = useState<EnvVariable[]>([]);
  const [mergeStrategy, setMergeStrategy] = useState<'replace' | 'keep' | 'replace-all'>('replace');

  const filtered = variables.filter(v =>
    v.key.toLowerCase().includes(search.toLowerCase()) ||
    (!v.hidden && v.value.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDownload = async () => {
    if (!canExport) {
      toast.error('You do not have permission to export variables.');
      return;
    }

    let content = `#######################################################\n`;
    content += `# Project\n# ${project.name}\n#\n`;
    content += `# Environment\n# ${env.charAt(0).toUpperCase() + env.slice(1)}\n#\n`;
    content += `# Downloaded By\n# ${user?.name || 'Unknown'}\n#\n`;
    content += `# Generated\n# ${dayjs().format('YYYY-MM-DD h:mm A')}\n`;
    content += `#######################################################\n\n`;

    variables.forEach(v => {
      let val = v.value;
      if (val.includes(' ') || val.includes('"') || val.includes("'")) {
        val = `"${val.replace(/"/g, '\\"')}"`;
      }
      content += `${v.key}=${val}\n`;
    });

    if ('showDirectoryPicker' in window) {
      try {
        toast(`Please select your project folder to save .env.${env}`, { duration: 3000 });
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        const fileHandle = await dirHandle.getFileHandle(`.env.${env}`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        toast.success(`Saved .env.${env} successfully!`);
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
          // Fallback to normal download if directory picker fails for some reason
        } else {
          return; // User cancelled
        }
      }
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `.env.${env}`);
    // Show a helpful toast for browsers that strip the dot
    toast.success(`Downloaded! (You may need to add the leading '.' if your browser removed it)`);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canImport) {
      toast.error('You do not have permission to import variables.');
      e.target.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseEnvString(content);
        const newVars = parsed.map(p => ({
          id: uuidv4(),
          key: p.key,
          value: p.value,
          description: '',
          hidden: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));
        setPendingVars(newVars);
        setMergeStrategy('replace');
        setIsOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  };

  const handleMergeConfirm = () => {
    if (!canImport) {
      toast.error('You do not have permission to import variables.');
      return;
    }

    importVariables(env, pendingVars, mergeStrategy);
    setIsOpen(false);
    toast.success(`Imported ${pendingVars.length} variable(s) using "${mergeStrategy}" strategy.`);
    setPendingVars([]);
  };

  const handleCopy = (text: string, label: string) => {
    if (label === 'Value' && !canReveal) {
      toast.error('You do not have permission to reveal secret values.');
      return;
    }

    navigator.clipboard.writeText(text);
    toast(`${label} copied to clipboard.`, { duration: 1500 });
  };

  return (
    <div className="space-y-4">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Variables – Choose Strategy</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Found <span className="font-semibold text-foreground">{pendingVars.length}</span> variable(s) in the uploaded file. How should they be merged?
            </p>
            <RadioGroup
              value={mergeStrategy}
              onValueChange={(v) => setMergeStrategy(v as typeof mergeStrategy)}
              className="gap-4"
            >
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="replace" id="r1" className="mt-1" />
                <Label htmlFor="r1" className="font-normal cursor-pointer">
                  <span className="font-medium block mb-1">Replace matching</span>
                  <span className="text-muted-foreground text-sm">Update values for matching keys, add new ones.</span>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="keep" id="r2" className="mt-1" />
                <Label htmlFor="r2" className="font-normal cursor-pointer">
                  <span className="font-medium block mb-1">Keep existing</span>
                  <span className="text-muted-foreground text-sm">Keep existing values, only add new keys.</span>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="replace-all" id="r3" className="mt-1" />
                <Label htmlFor="r3" className="font-normal cursor-pointer">
                  <span className="font-medium block mb-1">Replace all</span>
                  <span className="text-muted-foreground text-sm">Discard all current variables and use the uploaded file.</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleMergeConfirm}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h3 className="text-lg font-semibold capitalize">{env} Variables</h3>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!canExport}>
            <Download size={16} className="mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={!canImport}>
            <Upload size={16} className="mr-2" />
            Upload
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".env,.*" onChange={handleUpload} />
          <Button size="sm" onClick={() => addVariable(env)} disabled={!canCreate}>
            <Plus size={16} className="mr-2" />
            Add Variable
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-xl border border-dashed border-border">
          <p className="text-muted-foreground">No variables found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((variable) => (
            <div key={variable.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-card p-3 rounded-xl border border-border shadow-sm transition-all hover:border-primary">
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => reorderVariable(env, variable.id, 'up')} disabled={!canUpdate}>
                  <ArrowUp size={14} />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => reorderVariable(env, variable.id, 'down')} disabled={!canUpdate}>
                  <ArrowDown size={14} />
                </Button>
              </div>

              <Input
                placeholder="KEY"
                value={variable.key}
                onChange={(e) => updateVariable(env, variable.id, { key: e.target.value })}
                disabled={!canUpdate}
                className="w-full sm:w-1/3 font-mono text-sm"
              />

              <div className="w-full sm:w-1/2 relative flex items-center">
                <Input
                  placeholder="VALUE"
                  value={variable.value}
                  onChange={(e) => updateVariable(env, variable.id, { value: e.target.value })}
                  type={variable.hidden ? "password" : "text"}
                  disabled={!canUpdate}
                  className="w-full font-mono text-sm pr-10"
                />
                <button
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                  onClick={() => canReveal ? updateVariable(env, variable.id, { hidden: !variable.hidden }) : toast.error('You do not have permission to reveal secret values.')}
                  type="button"
                  disabled={!canReveal}
                >
                  {variable.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="flex items-center gap-1 w-full sm:w-auto sm:ml-auto">
                <Tooltip>
                  <TooltipTrigger render={<Button size="icon" variant="ghost" onClick={() => handleCopy(variable.key, 'Key')} />}>
                    <Copy size={16} />
                  </TooltipTrigger>
                  <TooltipContent>Copy Key</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger render={<Button size="icon" variant="ghost" onClick={() => handleCopy(variable.value, 'Value')} disabled={!canReveal} />}>
                    <Copy size={16} className="text-primary" />
                  </TooltipTrigger>
                  <TooltipContent>Copy Value</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger render={<Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteVariable(env, variable.id)} disabled={!canDelete} />}>
                    <Trash2 size={16} />
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
