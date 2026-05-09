import { format, formatDistanceToNow } from "date-fns";
import { Download, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDownloadUrl } from "@/lib/utils";
import { RobloxVersion } from "@workspace/api-client-react";

interface VersionRowProps {
  version: RobloxVersion;
  isLatest?: boolean;
}

const getTypeColor = (type: string) => {
  switch (type) {
    case "WindowsPlayer":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "Studio64":
    case "Studio":
      return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
    case "MacPlayer":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "MacStudio":
      return "bg-teal-500/10 text-teal-500 border-teal-500/20";
    default:
      return "bg-gray-500/10 text-gray-400 border-gray-500/20";
  }
};

export function VersionRow({ version, isLatest }: VersionRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(version.versionHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const date = new Date(version.deployedAt);
  const downloadUrl = getDownloadUrl(version.type, version.versionHash);

  return (
    <div className={`group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4 transition-colors hover:bg-muted/50 ${isLatest ? 'border border-primary/20 bg-primary/5 rounded-lg' : 'border-b border-border'}`}>
      <div className="flex flex-col gap-1.5 w-full sm:w-auto">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium text-foreground tracking-tight">
            {version.versionHash}
          </span>
          <Badge variant="outline" className={`font-mono uppercase text-[10px] tracking-wider px-2 py-0.5 ${getTypeColor(version.type)}`}>
            {version.type}
          </Badge>
          {isLatest && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase tracking-wider">
              Latest
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {version.versionNumber && (
            <span className="flex items-center gap-1.5">
              <span className="opacity-50">v</span>
              <span className="font-mono">{version.versionNumber}</span>
            </span>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default border-b border-dashed border-muted-foreground/30">
                {formatDistanceToNow(date, { addSuffix: true })}
              </span>
            </TooltipTrigger>
            <TooltipContent className="font-mono text-xs">
              {format(date, "PPP 'at' pp")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button 
          variant="outline" 
          size="icon"
          className="h-8 w-8 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        
        <Button asChild size="sm" className="w-full sm:w-auto h-8 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-none font-medium">
          <a href={downloadUrl} download>
            <Download className="h-4 w-4 mr-2" />
            Download
          </a>
        </Button>
      </div>
    </div>
  );
}
