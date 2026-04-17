"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Network, Search, SlidersHorizontal, X, ChevronRight } from "lucide-react";

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
  const [canvasHeight, setCanvasHeight] = useState(660);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.clientWidth);
      }
      const vh = window.innerHeight;
      setCanvasHeight(Math.max(520, Math.min(vh - 260, 860)));
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", updateSize);
    return () => { ro.disconnect(); window.removeEventListener("resize", updateSize); };
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
    setHoveredNodeId(null);
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
          { href: `/votometro?lang=${lang}`, label: "Votómetro" },
          { href: `/sigue-el-dinero?lang=${lang}`, label: "SigueElDinero" },
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="sed-hero" ref={heroRef}>
        <div className="sed-hero__inner">
          <div className="sed-hero__top sed-hero__animate">
            <div className="sed-hero__badge">
              <Network size={13} aria-hidden="true" />
              <span>{t.eyebrow}</span>
            </div>
            <h1 className="sed-hero__title">{t.title}</h1>
            <p className="sed-hero__desc">{t.subtitle}</p>
          </div>

          {/* Search + filters row */}
          <div className="sed-hero__search-row sed-hero__animate">
            <form className="sed-search-bar" onSubmit={handleSearchSubmit}>
              <Search size={15} className="sed-search-bar__icon" aria-hidden="true" />
              <input
                type="text"
                className="sed-search-bar__input"
                placeholder={t.searchPlaceholder}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label={t.searchPlaceholder}
              />
              {searchQuery && (
                <button type="button" className="sed-search-bar__clear" onClick={clearSearch} aria-label="Limpiar búsqueda">
                  <X size={13} aria-hidden="true" />
                </button>
              )}
              <button type="submit" className="sed-search-bar__btn" disabled={isSearching}>
                {isSearching ? (lang === "es" ? "Buscando…" : "Searching…") : t.searchButton}
              </button>
            </form>

            <button
              className={`sed-filter-toggle${filterOpen ? " sed-filter-toggle--active" : ""}`}
              onClick={() => setFilterOpen((p) => !p)}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              {t.filterToggle}
            </button>

            <button
              className={`sed-legend-toggle${legendOpen ? " sed-legend-toggle--active" : ""}`}
              onClick={() => setLegendOpen((p) => !p)}
            >
              {t.legendTitle}
            </button>
          </div>

          {searchQuery && (
            <div className="sed-search-tag sed-hero__animate">
              <span>{lang === "es" ? "Red para:" : "Network for:"}</span>
              <strong>{searchQuery}</strong>
              <button onClick={clearSearch} aria-label="Limpiar"><X size={11} aria-hidden="true" /></button>
            </div>
          )}

          {/* Metric chips */}
          <div className="sed-hero-chips sed-hero__animate">
            <div className="sed-hero-chip">
              <span className="sed-hero-chip__val">{nodes.length.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</span>
              <span className="sed-hero-chip__lbl">{lang === "es" ? "nodos" : "nodes"}</span>
            </div>
            <div className="sed-hero-chip">
              <span className="sed-hero-chip__val">{highConfidenceEdges.toLocaleString(lang === "es" ? "es-CO" : "en-US")}</span>
              <span className="sed-hero-chip__lbl">{lang === "es" ? "vínculos fuertes" : "strong links"}</span>
            </div>
            <div className="sed-hero-chip">
              <span className="sed-hero-chip__val">
                {Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(visibleValue)}
              </span>
              <span className="sed-hero-chip__lbl">{lang === "es" ? "valor visible" : "visible value"}</span>
            </div>
            <div className="sed-hero-chip">
              <span className="sed-hero-chip__val">{activeDepartmentCount}</span>
              <span className="sed-hero-chip__lbl">{lang === "es" ? "departamentos" : "departments"}</span>
            </div>
          </div>

          {/* Ethical note */}
          <div className="sed-ethical-banner sed-hero__animate" role="note">
            <span>{t.disclaimer}</span>
          </div>
        </div>
      </section>

      {/* ── Workbench ──────────────────────────────────────────────────── */}
      <div className="sed-workbench" ref={workbenchRef}>

        {/* Status banners */}
        {networkMeta?.source === "mock" && (
          <div className="sed-status-banner is-warning" role="status">
            <strong>{lang === "es" ? "Modo de referencia activo." : "Reference mode active."}</strong>
            <span>
              {lang === "es"
                ? "Vista de referencia cargada. Busca una entidad o contratista para explorar su red real."
                : "Reference view loaded. Search for an entity or contractor to explore their real network."}
            </span>
          </div>
        )}
        {networkMeta?.partial && (
          <div className="sed-status-banner" role="status">
            <strong>{lang === "es" ? "Lectura parcial." : "Partial reading."}</strong>
            <span>
              {lang === "es"
                ? "El backend marcó este corte como parcial; conviene contrastarlo con la fuente antes de concluir."
                : "The backend flagged this slice as partial; cross-check it against the source before concluding."}
            </span>
          </div>
        )}

        {/* Filter panel (collapsible) */}
        {filterOpen && (
          <div className="sed-filter-panel">
            <div className="sed-filter-group">
              <label className="sed-filter-label">{t.filterConfidence}</label>
              <div className="sed-confidence-filter">
                <input
                  type="range" min={0} max={100} step={10}
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
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
            <button className="sed-filter-apply" onClick={() => { setFilterOpen(false); loadOverview(true); }}>
              {lang === "es" ? "Aplicar filtros" : "Apply filters"}
            </button>
          </div>
        )}

        {/* Tab bar */}
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
          {dataVersion && (
            <span className="sed-version-tag">
              {networkMeta?.source === "mock"
                ? lang === "es" ? "Referencia · 2026" : "Reference · 2026"
                : `v${dataVersion}`}
            </span>
          )}
        </div>

        {/* ── Content area ───────────────────────────────────────────── */}
        <div className="sed-content-area">

          {/* Network tab — full-width canvas */}
          {activeTab === "red" && (
            <div className="sed-network-layout">
              <div className="sed-canvas-col">
                {selectedNode && (
                  <div className="sed-focus-banner" role="status">
                    <div className="sed-focus-banner__copy">
                      <strong>{lang === "es" ? "Modo foco activo" : "Focus mode active"}</strong>
                      <span>
                        {lang === "es"
                          ? `Ahora ves la red directa de ${selectedNode.label}. Cierra este foco para volver al panorama completo.`
                          : `You are looking at ${selectedNode.label}'s direct network. Clear focus to return to the full overview.`}
                      </span>
                    </div>
                    <button className="sed-focus-banner__reset" onClick={handleBackgroundClick}>
                      {lang === "es" ? "Ver panorama general" : "Show full overview"}
                    </button>
                  </div>
                )}
                <div className="sed-canvas-wrap" ref={containerRef}>
                  {error ? (
                    <NetworkError message={error} onRetry={() => loadOverview(true)} />
                  ) : (
                    <>
                      {(isLoading || isExpanding || isSearching) && (
                        <NetworkLoadingOverlay visible={isLoading || isExpanding || isSearching} lang={lang} />
                      )}
                      {!isLoading && nodes.length === 0 && !error && (
                        <div className="sed-canvas-empty">
                          <Network size={36} strokeWidth={1} style={{ opacity: 0.15 }} />
                          {searchQuery ? (
                            <p>
                              {lang === "es"
                                ? `Sin resultados para "${searchQuery}". Intenta sin tildes o con el nombre oficial.`
                                : `No results for "${searchQuery}". Try without accents or use the official name.`}
                            </p>
                          ) : (
                            <p>{lang === "es" ? "Sin datos en la red" : "No network data"}</p>
                          )}
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
                          height={canvasHeight}
                        />
                      )}
                    </>
                  )}
                </div>

                {legendOpen && <NetworkLegend lang={lang} />}

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
                    {!selectedNodeId && (
                      <>
                        <span className="sed-stats-bar__sep">·</span>
                        <span className="sed-stats-bar__hint">
                          {lang === "es" ? "Haz clic en un nodo para ver detalles" : "Click a node to see details"}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "concentracion" && <ConcentrationView nodes={nodes} lang={lang} />}
          {activeTab === "evidencia" && (
            <EvidenceTable edges={filteredEdges} nodes={nodes} lang={lang} selectedNodeId={selectedNodeId} />
          )}
        </div>
      </div>

      {/* ── Sliding node detail drawer ──────────────────────────────── */}
      {/* Backdrop */}
      {selectedNodeId && (
        <div
          className="sed-drawer-backdrop"
          onClick={handleBackgroundClick}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sed-node-drawer${selectedNodeId ? " sed-node-drawer--open" : ""}`}
        aria-label={lang === "es" ? "Detalle del nodo" : "Node detail"}
      >
        <div className="sed-drawer-header">
          <span className="sed-drawer-eyebrow">
            <ChevronRight size={13} aria-hidden="true" />
            {lang === "es" ? "Detalle del nodo" : "Node detail"}
          </span>
          <button
            className="sed-drawer-close"
            onClick={handleBackgroundClick}
            aria-label={lang === "es" ? "Cerrar panel" : "Close panel"}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <NodePanel
          node={selectedNode}
          detail={selectedNodeDetail}
          isLoading={isLoadingDetail}
          lang={lang}
          onExpand={handleExpand}
          isExpanding={isExpanding}
        />
      </aside>

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
