'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface MeshSettings {
  enablePbr?: boolean
  faceCount?: number
  generateType?: 'Normal' | 'LowPoly' | 'Geometry'
  polygonType?: 'triangle' | 'quadrilateral'
  topology?: 'quad' | 'triangle'
  targetPolycount?: number
  shouldRemesh?: boolean
  symmetryMode?: 'off' | 'auto' | 'on'
  isATpose?: boolean
}

interface MeshSettingsPanelProps {
  settings: MeshSettings
  onChange: (settings: MeshSettings) => void
  modelType?: 'hunyuan' | 'meshy' | 'rodin' | 'generic'
  className?: string
}

export function MeshSettingsPanel({
  settings,
  onChange,
  modelType = 'generic',
  className,
}: MeshSettingsPanelProps) {
  const update = (partial: Partial<MeshSettings>) => {
    onChange({ ...settings, ...partial })
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* PBR Toggle - Most models support this */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="pbr">PBR Materials</Label>
          <p className="text-xs text-muted-foreground">
            Generate physically-based rendering textures
          </p>
        </div>
        <Switch
          id="pbr"
          checked={settings.enablePbr || false}
          onCheckedChange={(checked) => update({ enablePbr: checked })}
        />
      </div>

      {/* Face Count - Hunyuan models */}
      {(modelType === 'hunyuan' || modelType === 'generic') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Face Count</Label>
            <span className="text-sm text-muted-foreground">
              {((settings.faceCount || 500000) / 1000).toFixed(0)}K
            </span>
          </div>
          <Slider
            value={[settings.faceCount || 500000]}
            onValueChange={([v]) => update({ faceCount: v })}
            min={40000}
            max={1500000}
            step={10000}
          />
          <p className="text-xs text-muted-foreground">
            Higher values produce more detail but larger files
          </p>
        </div>
      )}

      {/* Generate Type - Hunyuan models */}
      {modelType === 'hunyuan' && (
        <div className="space-y-2">
          <Label>Generate Type</Label>
          <Select
            value={settings.generateType || 'Normal'}
            onValueChange={(v) =>
              update({
                generateType: v as 'Normal' | 'LowPoly' | 'Geometry',
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Normal">Normal (Textured)</SelectItem>
              <SelectItem value="LowPoly">Low Poly</SelectItem>
              <SelectItem value="Geometry">Geometry Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Topology - Meshy models */}
      {(modelType === 'meshy' || modelType === 'generic') && (
        <div className="space-y-2">
          <Label>Topology</Label>
          <Select
            value={settings.topology || 'triangle'}
            onValueChange={(v) =>
              update({ topology: v as 'quad' | 'triangle' })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="triangle">Triangle (Detailed)</SelectItem>
              <SelectItem value="quad">Quad (Smooth)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Target Polycount - Meshy models */}
      {modelType === 'meshy' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Target Polycount</Label>
            <span className="text-sm text-muted-foreground">
              {((settings.targetPolycount || 30000) / 1000).toFixed(0)}K
            </span>
          </div>
          <Slider
            value={[settings.targetPolycount || 30000]}
            onValueChange={([v]) => update({ targetPolycount: v })}
            min={5000}
            max={100000}
            step={1000}
          />
        </div>
      )}

      {/* Symmetry Mode - Meshy models */}
      {modelType === 'meshy' && (
        <div className="space-y-2">
          <Label>Symmetry Mode</Label>
          <Select
            value={settings.symmetryMode || 'auto'}
            onValueChange={(v) =>
              update({ symmetryMode: v as 'off' | 'auto' | 'on' })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="on">Enforce Symmetry</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Remesh - Meshy models */}
      {modelType === 'meshy' && (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="remesh">Remesh</Label>
            <p className="text-xs text-muted-foreground">
              Enable mesh optimization phase
            </p>
          </div>
          <Switch
            id="remesh"
            checked={settings.shouldRemesh !== false}
            onCheckedChange={(checked) => update({ shouldRemesh: checked })}
          />
        </div>
      )}

      {/* T-Pose - For character models */}
      {(modelType === 'meshy' || modelType === 'rodin') && (
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="tpose">T/A-Pose</Label>
            <p className="text-xs text-muted-foreground">
              Generate in rigging-ready pose
            </p>
          </div>
          <Switch
            id="tpose"
            checked={settings.isATpose || false}
            onCheckedChange={(checked) => update({ isATpose: checked })}
          />
        </div>
      )}
    </div>
  )
}
