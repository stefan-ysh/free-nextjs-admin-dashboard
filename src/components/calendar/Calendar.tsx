"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { DateSelectArg, DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import { Info, Loader2, Trash2 } from 'lucide-react';

import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { formatDateOnly, toChinaDateTimeIso } from '@/lib/dates';
import type { CalendarEventCategory, CalendarEventRecord, CalendarEventPayload } from '@/types/calendar';
import ModalShell from '@/components/common/ModalShell';

type CalendarFormState = {
  id?: string;
  title: string;
  calendar: CalendarEventCategory;
  description: string;
  location: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

const palette: Record<CalendarEventCategory, { label: string; card: string; dot: string; hint: string }> = {
  meeting: {
    label: '会议',
    card: 'border-chart-1/30 bg-chart-1/10',
    dot: 'bg-chart-1',
    hint: '周会、项目讨论等团队协作事项',
  },
  deadline: {
    label: '截止',
    card: 'border-destructive/30 bg-destructive/10',
    dot: 'bg-destructive',
    hint: '交付与审批等关键里程碑',
  },
  reminder: {
    label: '提醒',
    card: 'border-chart-3/30 bg-chart-3/10',
    dot: 'bg-chart-3',
    hint: '轻量提醒、跟进和待办',
  },
  travel: {
    label: '出差',
    card: 'border-chart-5/30 bg-chart-5/10',
    dot: 'bg-chart-5',
    hint: '差旅、外出拜访等安排',
  },
};

const emptyFormState: CalendarFormState = {
  title: '',
  calendar: 'meeting',
  description: '',
  location: '',
  allDay: true,
  startDate: '',
  endDate: '',
  startTime: '09:00',
  endTime: '10:00',
};

function formatDateInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatDateOnly(date) ?? '';
}

function formatTimeInput(value?: string) {
  if (!value) return '09:00';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '09:00';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function combineDateTime(date: string, time: string): string {
  return toChinaDateTimeIso(date, time);
}

function toFormState(event: CalendarEventRecord): CalendarFormState {
  const isAllDay = event.allDay;
  return {
    id: event.id,
    title: event.title,
    calendar: event.calendar,
    description: event.description ?? '',
    location: event.location ?? '',
    allDay: isAllDay,
    startDate: formatDateInput(event.start),
    endDate: formatDateInput(event.end ?? event.start),
    startTime: isAllDay ? '09:00' : formatTimeInput(event.start),
    endTime: isAllDay ? '18:00' : formatTimeInput(event.end ?? event.start),
  };
}

function normalizeSelection(selectInfo: DateSelectArg): { startDate: string; endDate: string; allDay: boolean } {
  const startDate = formatDateInput(selectInfo.startStr);
  let endDate = formatDateInput(selectInfo.endStr ?? selectInfo.startStr);

  // FullCalendar's end date for all-day events is exclusive (next day after selection)
  // We need to subtract 1 day to get the actual last selected date
  if (selectInfo.allDay && selectInfo.endStr) {
    // Use the date string directly to avoid timezone issues
    const endParts = selectInfo.endStr.split('-');
    const endDateObj = new Date(Date.UTC(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2])));
    endDateObj.setUTCDate(endDateObj.getUTCDate() - 1);
    const year = endDateObj.getUTCFullYear();
    const month = String(endDateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(endDateObj.getUTCDate()).padStart(2, '0');
    endDate = `${year}-${month}-${day}`;
  }

  return {
    startDate,
    endDate: endDate || startDate,
    allDay: selectInfo.allDay ?? true,
  };
}

function renderEventContent(arg: EventContentArg) {
  const calendar = (arg.event.extendedProps.calendar ?? 'meeting') as CalendarEventCategory;
  const theme = palette[calendar] ?? palette.meeting;
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl border px-2 py-1 text-[11px] leading-tight shadow-sm backdrop-blur',
        theme.card
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', theme.dot)} />
        <span className="text-xs font-semibold text-foreground">{arg.event.title}</span>
      </div>
      {arg.timeText ? (
        <span className="text-[10px] text-muted-foreground">{arg.timeText}</span>
      ) : null}
      {arg.event.extendedProps.location ? (
        <span className="text-[10px] text-muted-foreground">{String(arg.event.extendedProps.location)}</span>
      ) : null}
    </div>
  );
}

const Calendar = () => {
  const calendarRef = useRef<FullCalendar>(null);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState<CalendarFormState>(emptyFormState);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [removing, setRemoving] = useState(false);

  const fetchEvents = useCallback(
    async (range: { start: string; end: string }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('start', range.start);
        params.set('end', range.end);
        const res = await fetch(`/api/calendar/events?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '无法获取日程');
        }
        setEvents(data.data ?? []);
      } catch (error) {
        console.error(error);
        toast.error('日程加载失败', {
          description: error instanceof Error ? error.message : '请稍后再试',
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const resetForm = useCallback((preset?: Partial<CalendarFormState>) => {
    setFormState({ ...emptyFormState, ...preset });
  }, []);

  useEffect(() => {
    if (visibleRange) {
      void fetchEvents(visibleRange);
    }
  }, [visibleRange, fetchEvents]);

  useEffect(() => {
    if (!dialogOpen) {
      const timeout = setTimeout(() => resetForm(), 200);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [dialogOpen, resetForm]);

  const calendarEvents = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        extendedProps: {
          calendar: event.calendar,
          location: event.location,
          description: event.description,
        },
      })),
    [events]
  );

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const openCreateDialog = useCallback((preset?: Partial<CalendarFormState>) => {
    resetForm(preset);
    setDialogOpen(true);
  }, [resetForm]);



  const handleSelect = useCallback(
    (selectInfo: DateSelectArg) => {
      const normalized = normalizeSelection(selectInfo);
      const startTime = normalized.allDay ? '09:00' : formatTimeInput(selectInfo.startStr);
      const endTime = normalized.allDay
        ? '18:00'
        : formatTimeInput(selectInfo.endStr ?? selectInfo.startStr);
      openCreateDialog({
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        allDay: normalized.allDay,
        startTime,
        endTime,
      });
      calendarRef.current?.getApi().unselect();
    },
    [openCreateDialog]
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const target = events.find((event) => event.id === arg.event.id);
      if (!target) return;
      setFormState(toFormState(target));
      setDialogOpen(true);
    },
    [events]
  );

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setVisibleRange({ start: arg.startStr, end: arg.endStr });
  }, []);

  const validateForm = () => {
    if (!formState.title.trim()) {
      toast.error('请输入日程标题');
      return false;
    }
    if (!formState.startDate) {
      toast.error('请选择开始日期');
      return false;
    }
    const endDate = formState.endDate || formState.startDate;
    const startTime = formState.allDay ? '00:00' : formState.startTime || '09:00';
    const endTime = formState.allDay ? '23:59' : formState.endTime || startTime;
    const start = new Date(toChinaDateTimeIso(formState.startDate, startTime)).getTime();
    const end = new Date(toChinaDateTimeIso(endDate, endTime)).getTime();
    if (end < start) {
      toast.error('结束时间不能早于开始时间');
      return false;
    }
    return true;
  };

  const buildPayload = (): CalendarEventPayload => {
    const endDate = formState.endDate || formState.startDate;
    const start = combineDateTime(formState.startDate, formState.allDay ? '00:00' : formState.startTime);
    const end = combineDateTime(endDate, formState.allDay ? '23:59' : formState.endTime || formState.startTime);
    return {
      title: formState.title.trim(),
      calendar: formState.calendar,
      start,
      end,
      allDay: formState.allDay,
      description: formState.description?.trim() || undefined,
      location: formState.location?.trim() || undefined,
    };
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      const isEdit = Boolean(formState.id);
      const res = await fetch(isEdit ? `/api/calendar/events/${formState.id}` : '/api/calendar/events', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '保存失败');
      }
      toast.success(isEdit ? '日程已更新' : '日程已创建');
      closeDialog();
      if (visibleRange) {
        await fetchEvents(visibleRange);
      }
    } catch (error) {
      console.error(error);
      toast.error('保存失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!formState.id) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/calendar/events/${formState.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '删除失败');
      }
      toast.success('日程已删除');
      closeDialog();
      if (visibleRange) {
        await fetchEvents(visibleRange);
      }
    } catch (error) {
      console.error(error);
      toast.error('删除失败', {
        description: error instanceof Error ? error.message : '请稍后再试',
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="surface-card flex h-full flex-col p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">团队日程</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="使用说明" className="text-muted-foreground transition hover:text-foreground">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>使用顶栏快速切换视图，点击日期或拖拽即可新增日程。</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => visibleRange && fetchEvents(visibleRange)} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              刷新
            </Button>

          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-col space-y-3 overflow-hidden">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {Object.entries(palette).map(([value, meta]) => (
              <div key={value} className={cn('flex items-center gap-2 rounded-full border px-3 py-1', meta.card)}>
                <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                <span className="font-medium capitalize">{meta.label}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label={`${meta.label} 说明`} className="text-muted-foreground transition hover:text-foreground">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{meta.hint}</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>

          <div className="relative custom-calendar flex-1 overflow-hidden rounded-xl">
            {loading ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : null}
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
              events={calendarEvents}
              height="100%"
              contentHeight="auto"
              expandRows
              selectable
              selectMirror
              dayMaxEvents
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              select={handleSelect}
              eventClick={handleEventClick}
              datesSet={handleDatesSet}
              eventContent={renderEventContent}
            />
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl overflow-hidden p-0">
            <ModalShell
              title={formState.id ? '编辑日程' : '新增日程'}
              headerActions={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="填写提示" className="text-muted-foreground transition hover:text-foreground">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>仅保留必要字段，详细说明请填入描述或地点。</p>
                  </TooltipContent>
                </Tooltip>
              }
              footer={
                <DialogFooter className="gap-2">
                  {formState.id ? (
                    <Button variant="destructive" className="mr-auto" onClick={handleDelete} disabled={removing}>
                      {removing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      删除
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={closeDialog} disabled={saving || removing}>
                    取消
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    保存
                  </Button>
                </DialogFooter>
              }
            >
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">标题</Label>
                  <Input id="title" value={formState.title} onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))} placeholder="如：成本评审会" />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label>类型</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="类型说明" className="text-muted-foreground transition hover:text-foreground">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>标签用于渲染不同的颜色和含义。</TooltipContent>
                    </Tooltip>
                  </div>
                  <Select value={formState.calendar} onValueChange={(value) => setFormState((prev) => ({ ...prev, calendar: value as CalendarEventCategory }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(palette).map(([value, meta]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                            {meta.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <DatePicker label="开始日期" value={formState.startDate} onChange={(value: string) => setFormState((prev) => ({ ...prev, startDate: value, endDate: prev.endDate || value }))} clearable={false} />
                  <DatePicker label="结束日期" value={formState.endDate} onChange={(value: string) => setFormState((prev) => ({ ...prev, endDate: value }))} clearable={false} />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3 dark:border-border">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">全天日程</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="全天日程说明" className="text-muted-foreground transition hover:text-foreground">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>关闭后可设置具体的起止时间</TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch checked={formState.allDay} onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, allDay: checked }))} />
                </div>

                {!formState.allDay ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="startTime">开始时间</Label>
                      <Input id="startTime" type="time" value={formState.startTime} onChange={(event) => setFormState((prev) => ({ ...prev, startTime: event.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endTime">结束时间</Label>
                      <Input id="endTime" type="time" value={formState.endTime} onChange={(event) => setFormState((prev) => ({ ...prev, endTime: event.target.value }))} />
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="location">地点 (可选)</Label>
                  <Input id="location" value={formState.location} onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))} placeholder="如：上海总部 3F 大会议室" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">描述 (可选)</Label>
                  <Textarea id="description" value={formState.description} onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))} rows={3} placeholder="补充议程、参与人或链接" />
                </div>
              </div>
            </ModalShell>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default Calendar;
