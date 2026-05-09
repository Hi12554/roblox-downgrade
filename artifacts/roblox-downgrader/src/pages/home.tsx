import { useState } from "react";
import { useListVersions, getListVersionsQueryKey, useGetLatestVersions, getGetLatestVersionsQueryKey } from "@workspace/api-client-react";
import { ListVersionsType } from "@workspace/api-client-react";
import { VersionRow } from "@/components/VersionRow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Database, ChevronLeft, ChevronRight } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const NOW = new Date();
const CURRENT_MONTH = NOW.getMonth() + 1;
const CURRENT_YEAR = NOW.getFullYear();

const MIN_YEAR = 2013;

export default function Home() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [type, setType] = useState<ListVersionsType | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState<number>(CURRENT_MONTH);
  const [year, setYear] = useState<number>(CURRENT_YEAR);

  const params = {
    search: debouncedSearch || undefined,
    type,
    page,
    pageSize: 20,
    month,
    year,
  };

  const { data: latestVersions } = useGetLatestVersions({
    query: { queryKey: getGetLatestVersionsQueryKey() }
  });

  const { data: listData, isLoading: loadingList } = useListVersions(
    params,
    { query: { queryKey: getListVersionsQueryKey(params) } }
  );

  const types: { label: string; value: ListVersionsType | undefined }[] = [
    { label: "All", value: undefined },
    { label: "Windows", value: ListVersionsType.WindowsPlayer },
    { label: "Studio", value: ListVersionsType.Studio64 },
    { label: "Mac", value: ListVersionsType.MacPlayer },
    { label: "Mac Studio", value: ListVersionsType.MacStudio }
  ];

  const years = Array.from(
    { length: CURRENT_YEAR - MIN_YEAR + 1 },
    (_, i) => CURRENT_YEAR - i
  );

  function prevMonth() {
    if (month === 1) {
      if (year > MIN_YEAR) { setMonth(12); setYear(y => y - 1); }
    } else {
      setMonth(m => m - 1);
    }
    setPage(1);
  }

  function nextMonth() {
    if (month === 12) {
      if (year < CURRENT_YEAR) { setMonth(1); setYear(y => y + 1); }
    } else if (year < CURRENT_YEAR || month < CURRENT_MONTH) {
      setMonth(m => m + 1);
    }
    setPage(1);
  }

  const isCurrentMonth = month === CURRENT_MONTH && year === CURRENT_YEAR;
  const isMinMonth = month === 1 && year === MIN_YEAR;

  const showLatest = !debouncedSearch && !type && isCurrentMonth && latestVersions && latestVersions.length > 0;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground selection:bg-primary/30">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-24 flex flex-col gap-12">

        {/* Header */}
        <header className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center text-primary">
              <Database className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-mono font-bold tracking-tight">RDD</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            Roblox Deployment Database. Search and download historical client and studio versions directly from the source.
          </p>
        </header>

        {/* Latest Versions */}
        {showLatest && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground font-semibold">Latest Deployments</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latestVersions.map((v, i) => (
                <VersionRow key={`${v.versionHash}-${v.type}-${i}`} version={v} isLatest />
              ))}
            </div>
          </section>
        )}

        {/* Controls */}
        <section className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 py-4 -mx-4 px-4 sm:mx-0 sm:px-0 flex flex-col gap-3">
          {/* Month navigator */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={prevMonth}
              disabled={isMinMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 flex-1 justify-center sm:justify-start">
              <Select
                value={String(month)}
                onValueChange={(v) => { setMonth(Number(v)); setPage(1); }}
              >
                <SelectTrigger className="w-36 h-8 font-mono text-sm bg-muted/20 border-border/50" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)} className="font-mono text-sm">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(year)}
                onValueChange={(v) => { setYear(Number(v)); setPage(1); }}
              >
                <SelectTrigger className="w-24 h-8 font-mono text-sm bg-muted/20 border-border/50" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)} className="font-mono text-sm">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={nextMonth}
              disabled={isCurrentMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Search + type filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by hash or version number..."
                className="pl-9 bg-muted/20 border-border/50 font-mono text-sm focus-visible:ring-primary/20"
                data-testid="input-search"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {types.map(t => (
                <Button
                  key={t.label}
                  variant={type === t.value ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => { setType(t.value); setPage(1); }}
                  className={`font-mono text-xs whitespace-nowrap ${type === t.value ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground'}`}
                  data-testid={`button-filter-${t.label.toLowerCase().replace(" ", "-")}`}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* List */}
        <section className="flex flex-col">
          {loadingList ? (
            <div className="py-24 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
          ) : listData?.versions.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center">
                <Search className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground font-mono text-sm">
                No versions found for {MONTH_NAMES[month - 1]} {year}
              </p>
            </div>
          ) : (
            <div className="flex flex-col border border-border rounded-xl bg-card overflow-hidden">
              {listData?.versions.map((v, i) => (
                <VersionRow key={`${v.versionHash}-${v.type}-${v.deployedAt}-${i}`} version={v} />
              ))}

              {/* Pagination */}
              {listData && listData.total > listData.pageSize && (
                <div className="p-4 border-t border-border flex items-center justify-between bg-muted/10">
                  <span className="text-xs font-mono text-muted-foreground">
                    {(listData.page - 1) * listData.pageSize + 1}–{Math.min(listData.page * listData.pageSize, listData.total)} of {listData.total}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      className="font-mono text-xs h-8"
                      data-testid="button-prev-page"
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page * listData.pageSize >= listData.total}
                      onClick={() => setPage(p => p + 1)}
                      className="font-mono text-xs h-8"
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
