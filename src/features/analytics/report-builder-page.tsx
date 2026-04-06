import { useState, useCallback } from 'react';
import {
  GripVertical,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Table,
  ScatterChart,
  Plus,
  Download,
  Save,
  Clock,
  X,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { BarChartWidget } from '@/components/charts/bar-chart-widget';
import { LineChartWidget } from '@/components/charts/line-chart-widget';
import { PieChartWidget } from '@/components/charts/pie-chart-widget';
import { cn } from '@/lib/utils';

type ChartType = 'bar' | 'line' | 'pie' | 'table' | 'scatter';

interface ReportWidget {
  id: string;
  type: ChartType;
  title: string;
  dataSource: string;
  data: Record<string, unknown>[];
}

const DATA_SOURCES = [
  { id: 'requests', label: 'Requests', icon: '📋' },
  { id: 'suppliers', label: 'Suppliers', icon: '🏢' },
  { id: 'contracts', label: 'Contracts', icon: '📄' },
  { id: 'spend', label: 'Spend', icon: '💰' },
  { id: 'compliance', label: 'Compliance', icon: '✅' },
];

const CHART_TYPES: { type: ChartType; label: string; icon: typeof BarChart3 }[] = [
  { type: 'bar', label: 'Bar', icon: BarChart3 },
  { type: 'line', label: 'Line', icon: LineChartIcon },
  { type: 'pie', label: 'Pie', icon: PieChartIcon },
  { type: 'table', label: 'Table', icon: Table },
  { type: 'scatter', label: 'Scatter', icon: ScatterChart },
];

const SAMPLE_WIDGETS: ReportWidget[] = [
  {
    id: 'w1',
    type: 'bar',
    title: 'Monthly Spend Trend',
    dataSource: 'spend',
    data: [
      { name: 'Jan', value: 2800000 },
      { name: 'Feb', value: 3100000 },
      { name: 'Mar', value: 3400000 },
      { name: 'Apr', value: 2900000 },
      { name: 'May', value: 3600000 },
      { name: 'Jun', value: 4100000 },
    ],
  },
  {
    id: 'w2',
    type: 'pie',
    title: 'Requests by Category',
    dataSource: 'requests',
    data: [
      { name: 'Software', value: 35 },
      { name: 'Services', value: 28 },
      { name: 'Consulting', value: 22 },
      { name: 'Goods', value: 15 },
    ],
  },
  {
    id: 'w3',
    type: 'line',
    title: 'Compliance Rate',
    dataSource: 'compliance',
    data: [
      { name: 'Jan', value: 82 },
      { name: 'Feb', value: 83 },
      { name: 'Mar', value: 84 },
      { name: 'Apr', value: 85 },
      { name: 'May', value: 86 },
      { name: 'Jun', value: 87 },
    ],
  },
];

let widgetCounter = 4;

export function ReportBuilderPage() {
  const [widgets, setWidgets] = useState<ReportWidget[]>(SAMPLE_WIDGETS);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [dragOverCanvas, setDragOverCanvas] = useState(false);

  const selectedWidget = widgets.find((w) => w.id === selectedWidgetId) ?? null;

  const handleDragStart = useCallback(
    (e: React.DragEvent, sourceId: string) => {
      e.dataTransfer.setData('text/plain', sourceId);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverCanvas(false);
      const sourceId = e.dataTransfer.getData('text/plain');
      const source = DATA_SOURCES.find((s) => s.id === sourceId);
      if (!source) return;

      const newWidget: ReportWidget = {
        id: `w${widgetCounter++}`,
        type: 'bar',
        title: `${source.label} Chart`,
        dataSource: sourceId,
        data: [
          { name: 'Item 1', value: 40 },
          { name: 'Item 2', value: 65 },
          { name: 'Item 3', value: 30 },
          { name: 'Item 4', value: 50 },
        ],
      };
      setWidgets((prev) => [...prev, newWidget]);
      setSelectedWidgetId(newWidget.id);
      toast.success(`Added ${source.label} widget`);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverCanvas(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCanvas(false);
  }, []);

  const removeWidget = useCallback(
    (id: string) => {
      setWidgets((prev) => prev.filter((w) => w.id !== id));
      if (selectedWidgetId === id) setSelectedWidgetId(null);
    },
    [selectedWidgetId],
  );

  const updateWidgetType = useCallback(
    (type: ChartType) => {
      if (!selectedWidgetId) return;
      setWidgets((prev) =>
        prev.map((w) => (w.id === selectedWidgetId ? { ...w, type } : w)),
      );
    },
    [selectedWidgetId],
  );

  const updateWidgetTitle = useCallback(
    (title: string) => {
      if (!selectedWidgetId) return;
      setWidgets((prev) =>
        prev.map((w) => (w.id === selectedWidgetId ? { ...w, title } : w)),
      );
    },
    [selectedWidgetId],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Report Builder"
        subtitle="Drag data sources to the canvas to build custom reports"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Export functionality coming soon')}
            >
              <Download className="mr-1.5 size-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Schedule functionality coming soon')}
            >
              <Clock className="mr-1.5 size-3.5" />
              Schedule
            </Button>
            <Button
              size="sm"
              onClick={() => toast.success('Report saved')}
            >
              <Save className="mr-1.5 size-3.5" />
              Save Report
            </Button>
          </div>
        }
      />

      <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Left Sidebar - Data Sources */}
        <div className="w-52 shrink-0 rounded-md bg-white p-3 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-3 text-xs font-semibold uppercase text-gray-500">Data Sources</h3>
          <div className="space-y-1.5">
            {DATA_SOURCES.map((source) => (
              <div
                key={source.id}
                draggable
                onDragStart={(e) => handleDragStart(e, source.id)}
                className="flex cursor-grab items-center gap-2 rounded-md border border-gray-100 p-2 text-sm transition-colors hover:border-blue-200 hover:bg-blue-50 active:cursor-grabbing"
              >
                <GripVertical className="size-3.5 text-gray-400" />
                <span>{source.icon}</span>
                <span className="text-gray-700">{source.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase text-gray-500">Quick Add</h3>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const newWidget: ReportWidget = {
                  id: `w${widgetCounter++}`,
                  type: 'bar',
                  title: 'New Chart',
                  dataSource: 'spend',
                  data: [
                    { name: 'A', value: 30 },
                    { name: 'B', value: 60 },
                    { name: 'C', value: 45 },
                  ],
                };
                setWidgets((prev) => [...prev, newWidget]);
                setSelectedWidgetId(newWidget.id);
              }}
            >
              <Plus className="mr-1.5 size-3.5" />
              Add Widget
            </Button>
          </div>
        </div>

        {/* Center Canvas */}
        <div
          className={cn(
            'flex-1 rounded-md border-2 border-dashed p-4 transition-colors',
            dragOverCanvas ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-gray-50/50',
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {widgets.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-gray-400">
                <BarChart3 className="mx-auto mb-2 size-12" />
                <p className="text-sm font-medium">Drop data sources here</p>
                <p className="text-xs">Drag from the sidebar to add widgets</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {widgets.map((widget) => (
                <div
                  key={widget.id}
                  className={cn(
                    'relative cursor-pointer rounded-md bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all',
                    selectedWidgetId === widget.id
                      ? 'ring-2 ring-blue-400'
                      : 'hover:shadow-md',
                  )}
                  onClick={() => setSelectedWidgetId(widget.id)}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">{widget.title}</h4>
                    <button
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWidget(widget.id);
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <WidgetRenderer widget={widget} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel - Widget Config */}
        <div className="w-60 shrink-0 rounded-md bg-white p-3 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
          <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-500">
            <Settings2 className="size-3.5" />
            Widget Config
          </h3>
          {selectedWidget ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
                <input
                  type="text"
                  value={selectedWidget.title}
                  onChange={(e) => updateWidgetTitle(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Chart Type</label>
                <div className="grid grid-cols-3 gap-1">
                  {CHART_TYPES.map((ct) => {
                    const Icon = ct.icon;
                    return (
                      <button
                        key={ct.type}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition-colors',
                          selectedWidget.type === ct.type
                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                            : 'border-gray-100 text-gray-500 hover:border-gray-300',
                        )}
                        onClick={() => updateWidgetType(ct.type)}
                      >
                        <Icon className="size-4" />
                        {ct.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Data Source</label>
                <p className="text-sm text-gray-700">{selectedWidget.dataSource}</p>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-600">Export Widget</p>
                <div className="mt-2 flex gap-1.5">
                  {['PDF', 'Excel', 'CSV'].map((fmt) => (
                    <Button
                      key={fmt}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => toast.info(`${fmt} export coming soon`)}
                    >
                      {fmt}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Select a widget to configure</p>
          )}
        </div>
      </div>
    </div>
  );
}

function WidgetRenderer({ widget }: { widget: ReportWidget }) {
  const chartData = widget.data as { name: string; value: number }[];

  switch (widget.type) {
    case 'bar':
      return (
        <BarChartWidget
          data={chartData}
          dataKeys={[{ key: 'value', color: '#1B2A4A', label: 'Value' }]}
          height={200}
        />
      );
    case 'line':
      return (
        <LineChartWidget
          data={chartData}
          dataKeys={[{ key: 'value', color: '#2E7D4F', label: 'Value' }]}
          height={200}
        />
      );
    case 'pie':
      return (
        <PieChartWidget
          data={chartData}
          height={200}
          showLegend
        />
      );
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs font-medium text-gray-500">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr key={row.name} className="border-b border-gray-50">
                  <td className="py-1.5 pr-4 text-gray-700">{row.name}</td>
                  <td className="py-1.5 text-right font-medium text-gray-900">
                    {typeof row.value === 'number' ? row.value.toLocaleString() : row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'scatter':
      // Render as a bar chart placeholder since Recharts scatter needs different data shape
      return (
        <BarChartWidget
          data={chartData}
          dataKeys={[{ key: 'value', color: '#D4782F', label: 'Value' }]}
          height={200}
        />
      );
    default:
      return <p className="text-sm text-gray-400">Unsupported chart type</p>;
  }
}
