"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Network, Search, SlidersHorizontal, X } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { NetworkCanvas } from "@/components/network/NetworkCanvas";
import { NodePanel } from "@/components/network/NodePanel";
import { EdgeModal } from "@/components/network/EdgeModal";
import { NetworkLegend } from "@/components/network/NetworkLegend";
import { ConcentrationView } from "@/components/network/ConcentrationView";
import { EvidenceTable } from "@/components/network/EvidenceTable";
import { NetworkError } from "@/components/network/NetworkError";
import { NetworkLoadingOverlay } from "@/components/network/NetworkLoadingOverlay";

import {
  fetchNetworkVersion,
  fetchNetworkOverview,
  fetchNetworkSearch,
  fetchNetworkExpand,
  fetchNetworkNodeDetail,
} from "@/lib/api";
import { getCachedGraph, setCachedGraph, isCacheStale } from "@/lib/network/cache";
import { networkConfig } from "@/lib/network/config";
import { filterEdgesByConfidence } from "@/lib/network/buildEdges";
import { sigueDineroCopy } from "@/lib/copy";

import type { Lang } from "@/lib/types";
import type { NetworkNode, NetworkEdge, NetworkNodeDetail, NetworkPayload } from "@/lib/network/types";

type Tab = "red" | "concentracion" | "evidencia";

type Props = {
  lang: Lang;
};

type NetworkMetaState = NetworkPayload["meta"] | null;

export function SigueElDineroView({ lang }: Props) {
  const t = sigueDineroCopy[lang];

  // ── Network state ──────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [edges, setEdges] = useState<NetworkEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<NetworkEdge | null>(null);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<NetworkNodeDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("red");
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [minConfidence, setMinConfidence] = useState<number>(networkConfig.confidence.defaultMinimum);
  const [department, setDepartment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dataVersion, setDataVersion] = useState<string | null>(null);
  const [networkMeta, setNetworkMeta] = useState<NetworkMetaState>(null);

  // ── Canvas size ────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState<number | undefined>(undefined);
  const CANVAS_HEIGHT = 560;

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.clientWidth);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Filtered edges (confidence slider) ────────────────────────────────────
  const filteredEdges = useMemo(
    () => filterEdgesByConfidence(edges, minConfidence),
    [edges, minConfidence],
  );

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadOverview = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      setError(null);
      try {
        // Check server version
        let serverVersion: string | null = null;
        try {
          const v = await fetchNetworkVersion();
          serverVersion = v.version;
          setDataVersion(v.version);
        } catch {
          // version check failure is non-fatal
        }

        // Check cache
        const cacheKey = `overview_${lang}_${department || "all"}_${minConfidence}`;
        if (!forceRefresh) {
          const cached = getCachedGraph(cacheKey);
          if (cached && (!serverVersion || !isCacheStale(cached, serverVersion))) {
            setNodes(cached.nodes);
            setEdges(cached.edges);
            setNetworkMeta(cached.meta);
            setIsLoading(false);
            return;
          }
        }

        const payload = await fetchNetworkOverview({
          lang,
          limit: networkConfig.canvas.initialHubs,
          department: department || undefined,
          minConfidence,
        });

        setNodes(payload.nodes);
        setEdges(payload.edges);
        setNetworkMeta(payload.meta);
        if (payload.meta.version) setDataVersion(payload.meta.version);

        // Cache it
        const cacheKey2 = `overview_${lang}_${department || "all"}_${minConfidence}`;
        setCachedGraph(cacheKey2, payload, networkConfig.cache.ttlMs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading network");
      } finally {
        setIsLoading(false);
      }
    },
    [lang, department, minConfidence],
  );

  // Initial load
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchQuery("");
        loadOverview(true);
        return;
      }
      setIsSearching(true);
      setError(null);
      try {
        const payload = await fetchNetworkSearch(q.trim(), lang, minConfidence);
        setNodes(payload.nodes);
        setEdges(payload.edges);
        setNetworkMeta(payload.meta);
        setSearchQuery(q.trim());
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setSelectedEdge(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setIsSearching(false);
      }
    },
    [lang, minConfidence, loadOverview],
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchInput);
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    loadOverview(true);
  };

  // ── Node interaction ───────────────────────────────────────────────────────
  const handleNodeClick = useCallback(
    async (node: NetworkNode) => {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      setSelectedEdge(null);
      setIsLoadingDetail(true);
      try {
        const detail = await fetchNetworkNodeDetail(node.id, lang);
        setSelectedNodeDetail(detail);
      } catch {
        setSelectedNodeDetail(null);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [lang],
  );

  const handleNodeHover = useCallback((node: NetworkNode | null) => {
    setHoveredNodeId(node?.id ?? null);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelectedEdge(null);
    setSelectedNodeDetail(null);
  }, []);

  // ── Edge interaction ───────────────────────────────────────────────────────
  const handleEdgeClick = useCallback((edge: NetworkEdge) => {
    setSelectedEdgeId(edge.id);
    setSelectedEdge(edge);
    setSelectedNodeId(null);
    setSelectedNodeDetail(null);
  }, []);

  // ── Expand node ────────────────────────────────────────────────────────────
  const handleExpand = useCallback(
    async (nodeId: string) => {
      setIsExpanding(true);
      try {
        const payload = await fetchNetworkExpand(nodeId, lang, minConfidence);
        setNodes((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const newNodes = payload.nodes.filter((n) => !existingIds.has(n.id));
          return [...prev, ...newNodes];
        });
        setEdges((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEdges = payload.edges.filter((e) => !existingIds.has(e.id));
          return [...prev, ...newEdges];
        });
      } catch {
        // non-fatal
      } finally {
        setIsExpanding(false);
      }
    },
    [lang, minConfidence],
  );

  // ── GSAP reveal ───────────────────────────────────────────────────────────
  const heroRef = useRef<HTMLDivElement>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (heroRef.current) {
      gsap.from(heroRef.current.querySelectorAll(".sed-hero__animate"), {
        y: 20,
        opacity: 0,
        stagger: 0.12,
        duration: 0.55,
        ease: "power2.out",
      });
    }
    if (workbenchRef.current) {
      gsap.from(workbenchRef.current, {
        opacity: 0,
        y: 16,
        duration: 0.5,
        delay: 0.35,
        ease: "power2.out",
      });
    }
  }, []);

  // ── Selected node (resolved from nodes array) ─────────────────────────────
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  // ── Departments for filter ─────────────────────────────────────────────────
  const departments = useMemo(() => {
    const set = new Set<string>();
    nodes.forEach((n) => { if (n.department) set.add(n.department); });
    return Array.from(set).sort();
  }, [nodes]);

  const visibleValue = useMemo(
    () => filteredEdges.reduce((sum, edge) => sum + edge.total_monto, 0),
    [filteredEdges],
  );

  const highConfidenceEdges = useMemo(
    () => filteredEdges.filter((edge) => edge.confidence >= 80).length,
    [filteredEdges],
  );

  const activeDepartmentCount = useMemo(
    () => new Set(filteredEdges.map((edge) => edge.departamento).filter(Boolean)).size,
    [filteredEdges],
  );

  const strongestNode = useMemo(
    () => [...nodes].sort((left, right) => right.total_value - left.total_value)[0] ?? null,
    [nodes],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="sed-page">
      <SiteNav
        lang={lang}
        links={[
          { href: `/contrato-limpio?lang=${lang}`, label: "ContratoLimpio" },
          { href: `/votometro?lang=${lang}`, label: "VotóMeter" },
          { href: `/sigue-el-dinero?lang=${lang}`, label: "SigueElDinero" },
        ]}
      />

      {/* Hero */}
      <section className="sed-hero" ref={heroRef}>
        <div className="sed-hero__inner">
          <div className="sed-hero__badge sed-hero__animate">
            <Network size={14} />
            <span>{t.eyebrow}</span>
          </div>
          <h1 className="sed-hero__title sed-hero__animate">{t.title}</h1>
          <p className="sed-hero__desc sed-hero__animate">{t.subtitle}</p>

          {/* Ethical note */}
          <div className="sed-ethical-banner sed-hero__animate" role="note">
            <span>{t.disclaimer}</span>
          </div>

          {/* Search bar */}
          <form className="sed-search-bar sed-hero__animate" onSubmit={handleSearchSubmit}>
            <Search size={16} className="sed-search-bar__icon" />
            <input
              type="text"
              className="sed-search-bar__input"
              placeholder={t.searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label={t.searchPlaceholder}
            />
            {searchQuery && (
              <button
                type="button"
                className="sed-search-bar__clear"
                onClick={clearSearch}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" className="sed-search-bar__btn" disabled={isSearching}>
              {isSearching ? (lang === "es" ? "Buscando…" : "Searching…") : t.searchButton}
            </button>
          </form>

          {/* Active search tag */}
          {searchQuery && (
            <div className="sed-search-tag">
              <span>{lang === "es" ? "Mostrando red para:" : "Showing network for:"}</span>
              <strong>{searchQuery}</strong>
              <button onClick={clearSearch}><X size={12} /></button>
            </div>
          )}

          <div className="sed-hero-metrics sed-hero__animate">
            <article className="sed-hero-card">
              <span>{lang === "es" ? "Nodos visibles" : "Visible nodes"}</span>
              <strong>{nodes.length.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</strong>
              <p>{lang === "es" ? "La escena actual del grafo" : "The current graph scene"}</p>
            </article>
            <article className="sed-hero-card">
              <span>{lang === "es" ? "Relaciones fuertes" : "High-confidence links"}</span>
              <strong>{highConfidenceEdges.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</strong>
              <p>{lang === "es" ? "Con confianza alta en esta vista" : "High-confidence edges in view"}</p>
            </article>
            <article className="sed-hero-card">
              <span>{lang === "es" ? "Valor visible" : "Visible value"}</span>
              <strong>
                {Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(visibleValue)}
              </strong>
              <p>{lang === "es" ? "Monto agregado en la red abierta" : "Aggregated value in the open graph"}</p>
            </article>
            <article className="sed-hero-card">
              <span>{lang === "es" ? "Pivote principal" : "Primary hub"}</span>
              <strong>{strongestNode?.label ?? "—"}</strong>
              <p>
                {lang === "es"
                  ? `${activeDepartmentCount} departamentos activos en la vista`
                  : `${activeDepartmentCount} departments active in view`}
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Workbench */}
      <div className="sed-workbench" ref={workbenchRef}>
        {networkMeta?.source === "mock" ? (
          <div className="sed-status-banner is-warning" role="status">
            <strong>{lang === "es" ? "Modo de referencia activo." : "Reference mode active."}</strong>
            <span>
              {lang === "es"
                ? "Esta vista cayó a datos de referencia y no al grafo completo del backend; por eso el volumen puede verse limitado."
                : "This view fell back to reference data instead of the full backend graph, so volume may look limited."}
            </span>
          </div>
        ) : null}

        {networkMeta?.partial ? (
          <div className="sed-status-banner" role="status">
            <strong>{lang === "es" ? "Lectura parcial." : "Partial reading."}</strong>
            <span>
              {lang === "es"
                ? "El backend marcó este corte como parcial; conviene contrastarlo con la fuente antes de concluir."
                : "The backend flagged this slice as partial; cross-check it against the source before concluding."}
            </span>
          </div>
        ) : null}

        {/* Filter strip */}
        <div className="sed-filter-strip">
          <button
            className={`sed-filter-toggle${filterOpen ? " sed-filter-toggle--active" : ""}`}
            onClick={() => setFilterOpen((p) => !p)}
          >
            <SlidersHorizontal size={14} />
            {t.filterToggle}
          </button>

          {dataVersion && (
            <span className="sed-version-tag">
              {lang === "es" ? "Grafo" : "Graph"} v{dataVersion}
            </span>
          )}

          <button
            className={`sed-legend-toggle${legendOpen ? " sed-legend-toggle--active" : ""}`}
            onClick={() => setLegendOpen((p) => !p)}
          >
            {t.legendTitle}
          </button>
        </div>

        {filterOpen && (
          <div className="sed-filter-panel">
            <div className="sed-filter-group">
              <label className="sed-filter-label">{t.filterConfidence}</label>
              <div className="sed-confidence-filter">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className="sed-confidence-slider"
                />
                <div className="sed-confidence-marks">
                  <button onClick={() => setMinConfidence(0)}>{t.filterConfidenceAll}</button>
                  <button onClick={() => setMinConfidence(60)}>{t.filterConfidenceVerified}</button>
                  <button onClick={() => setMinConfidence(80)}>{t.filterConfidenceHigh}</button>
                </div>
                <span className="sed-confidence-value">≥ {minConfidence}%</span>
              </div>
            </div>

            {departments.length > 0 && (
              <div className="sed-filter-group">
                <label className="sed-filter-label">{t.filterDepartment}</label>
                <select
                  className="sed-filter-select"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">{lang === "es" ? "Todos los departamentos" : "All departments"}</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="sed-filter-apply"
              onClick={() => { setFilterOpen(false); loadOverview(true); }}
            >
              {lang === "es" ? "Aplicar filtros" : "Apply filters"}
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div className="sed-summary-strip">
          <div className="sed-summary-chip">
            <span>{lang === "es" ? "Grafo total" : "Full graph"}</span>
            <strong>{networkMeta?.total_nodes?.toLocaleString(lang === "es" ? "es-CO" : "en-US") ?? "—"} {t.totalNodes}</strong>
          </div>
          <div className="sed-summary-chip">
            <span>{lang === "es" ? "Relaciones totales" : "Total relationships"}</span>
            <strong>{networkMeta?.total_edges?.toLocaleString(lang === "es" ? "es-CO" : "en-US") ?? "—"} {t.totalEdges}</strong>
          </div>
          <div className="sed-summary-chip">
            <span>{lang === "es" ? "Fuente" : "Source"}</span>
            <strong>
              {networkMeta?.source === "mock"
                ? lang === "es"
                  ? "Referencia"
                  : "Reference"
                : networkMeta
                  ? lang === "es"
                    ? "Grafo vivo"
                    : "Live graph"
                  : lang === "es"
                    ? "Cargando"
                    : "Loading"}
            </strong>
          </div>
          <div className="sed-summary-chip">
            <span>{lang === "es" ? "Cómo jugarlo" : "How to play it"}</span>
            <strong>{lang === "es" ? "Busca, filtra, abre y expande" : "Search, filter, open, expand"}</strong>
          </div>
        </div>

        <div className="sed-tab-bar" role="tablist">
          {(["red", "concentracion", "evidencia"] as Tab[]).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={`sed-tab${activeTab === tab ? " sed-tab--active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "red" ? t.tabNetwork : tab === "concentracion" ? t.tabConcentration : t.tabEvidence}
            </button>
          ))}
        </div>

        {/* Main content area */}
        <div className="sed-content-area">

          {/* Network tab */}
          {activeTab === "red" && (
            <div className="sed-network-layout">
              {/* Canvas column */}
              <div className="sed-canvas-col">
                <div className="sed-canvas-wrap" ref={containerRef}>
                  {error ? (
                    <NetworkError
                      message={error}
                      onRetry={() => loadOverview(true)}
                    />
                  ) : (
                    <>
                      {(isLoading || isExpanding || isSearching) && (
                        <NetworkLoadingOverlay visible={isLoading || isExpanding || isSearching} lang={lang} />
                      )}
                      {!isLoading && nodes.length === 0 && !error && (
                        <div className="sed-canvas-empty">
                          <Network size={32} strokeWidth={1} style={{ opacity: 0.2 }} />
                          <p>{lang === "es" ? "Sin datos en la red" : "No network data"}</p>
                        </div>
                      )}
                      {nodes.length > 0 && (
                        <NetworkCanvas
                          nodes={nodes}
                          edges={filteredEdges}
                          selectedNodeId={selectedNodeId}
                          selectedEdgeId={selectedEdgeId}
                          hoveredNodeId={hoveredNodeId}
                          lang={lang}
                          onNodeClick={handleNodeClick}
                          onEdgeClick={handleEdgeClick}
                          onNodeHover={handleNodeHover}
                          onBackgroundClick={handleBackgroundClick}
                          width={canvasWidth}
                          height={CANVAS_HEIGHT}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Legend (below canvas, collapsible) */}
                {legendOpen && (
                  <NetworkLegend lang={lang} />
                )}

                {/* Stats bar */}
                {!isLoading && nodes.length > 0 && (
                  <div className="sed-stats-bar">
                    <span>{nodes.length} {lang === "es" ? "nodos" : "nodes"}</span>
                    <span className="sed-stats-bar__sep">·</span>
                    <span>{filteredEdges.length} {lang === "es" ? "relaciones" : "relationships"}</span>
                    {minConfidence > 0 && (
                      <>
                        <span className="sed-stats-bar__sep">·</span>
                        <span>{lang === "es" ? "Confianza" : "Confidence"} ≥{minConfidence}%</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Node panel column */}
              <div className="sed-panel-col">
                <NodePanel
                  node={selectedNode}
                  detail={selectedNodeDetail}
                  isLoading={isLoadingDetail}
                  lang={lang}
                  onExpand={handleExpand}
                  isExpanding={isExpanding}
                />
              </div>
            </div>
          )}

          {/* Concentration tab */}
          {activeTab === "concentracion" && (
            <ConcentrationView nodes={nodes} lang={lang} />
          )}

          {/* Evidence tab */}
          {activeTab === "evidencia" && (
            <EvidenceTable
              edges={filteredEdges}
              nodes={nodes}
              lang={lang}
              selectedNodeId={selectedNodeId}
            />
          )}
        </div>
      </div>

      {/* Edge modal */}
      <EdgeModal
        edge={selectedEdge}
        lang={lang}
        onClose={() => { setSelectedEdge(null); setSelectedEdgeId(null); }}
      />

      <SiteFooter lang={lang} />
    </div>
  );
}
