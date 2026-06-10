import {
  memo,
  type CSSProperties,
  type DragEvent as ReactDragEvent
} from "react";

import type { Folder } from "@bookmark/shared";
import "./FolderOverviewTabs.css";
import "./FolderOverviewPanel.css";

export type MobileSidebarPanelId = "folder" | "bookmark" | "recommendation";
export type FolderOverviewDropMode = "reorder" | "move";
export type FolderOverviewSpecialFilter = "all" | "unfiled" | "trash";

type FolderOverviewActionResult = void | Promise<void>;

export type FolderOverviewNodeViewModel = {
  folder: Folder;
  childNodes: FolderOverviewNodeViewModel[];
  depth: number;
  bookmarkCount: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isActive: boolean;
  dropMode: FolderOverviewDropMode | null;
};

export type FolderOverviewNodeActions = {
  onToggleExpansion: (folderId: string) => FolderOverviewActionResult;
  onSelect: (folder: Folder) => FolderOverviewActionResult;
  onDragStart: (
    folderId: string,
    event: ReactDragEvent<HTMLButtonElement>
  ) => FolderOverviewActionResult;
  onDragEnd: () => FolderOverviewActionResult;
  onDragOver: (
    folder: Folder,
    event: ReactDragEvent<HTMLButtonElement>
  ) => FolderOverviewActionResult;
  onDragLeave: (folderId: string) => FolderOverviewActionResult;
  onDrop: (
    folder: Folder,
    event: ReactDragEvent<HTMLButtonElement>
  ) => FolderOverviewActionResult;
  onBeginEdit: (folder: Folder) => FolderOverviewActionResult;
  onBeginChildCreate: (folder: Folder) => FolderOverviewActionResult;
  onToggleActionMenu: (folderId: string) => FolderOverviewActionResult;
  onDelete: (folder: Folder) => FolderOverviewActionResult;
};

type FolderOverviewNodeProps = {
  node: FolderOverviewNodeViewModel;
  shouldUseMobileSidebarPanels: boolean;
  isReorderingFolders: boolean;
  openFolderActionMenuId: string | null;
  actions: FolderOverviewNodeActions;
};

export type FolderOverviewPanelProps = {
  activeSpecialFilter: FolderOverviewSpecialFilter | null;
  allBookmarkCount: number;
  allSystemItemAriaLabel?: string;
  allSystemItemIcon?: string;
  allSystemItemLabel?: string;
  contentLabel?: string;
  isAllFolderViewActive: boolean;
  isHidden?: boolean;
  isReorderingFolders: boolean;
  nodes: FolderOverviewNodeViewModel[];
  openFolderActionMenuId: string | null;
  query: string;
  shouldUseMobileSidebarPanels: boolean;
  showHiddenFolders: boolean;
  showHiddenFolderToggle?: boolean;
  showAllSystemItem?: boolean;
  showTrashSystemItem?: boolean;
  trashBookmarkCount: number;
  unfiledBookmarkCount: number;
  actions: FolderOverviewNodeActions;
  onCollapseAll: () => FolderOverviewActionResult;
  onExpandAll: () => FolderOverviewActionResult;
  onQueryChange: (value: string) => void;
  onReset: () => FolderOverviewActionResult;
  onSelectSpecialFilter: (
    filter: FolderOverviewSpecialFilter
  ) => FolderOverviewActionResult;
  onToggleHiddenFolders: () => FolderOverviewActionResult;
};

export type MobileSidebarTabItem = {
  panelId: MobileSidebarPanelId;
  heading: string;
  summary: string;
  kicker: string;
};

export type MobileSidebarTabsProps = {
  activePanel: MobileSidebarPanelId;
  items: MobileSidebarTabItem[];
  onSelectPanel: (panelId: MobileSidebarPanelId) => FolderOverviewActionResult;
  onPreloadPanel?: (panelId: MobileSidebarPanelId) => void;
};

function getFolderIconGlyph(icon: string | null | undefined) {
  switch (icon) {
    case "book-open":
      return "▤";
    case "newspaper":
      return "▥";
    case "file-text":
      return "≣";
    case "folder":
      return "□";
    case "link":
      return "↗";
    case "star":
      return "★";
    default:
      return null;
  }
}

function renderColorSwatch(color: string, className = "color-swatch") {
  return (
    <span
      className={className}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

function renderFolderOverviewNodeLabel(folder: Folder) {
  const folderIconGlyph = getFolderIconGlyph(folder.icon);

  return (
    <span className="folder-overview-name">
      {folderIconGlyph ? (
        <span
          aria-hidden="true"
          className="folder-icon-badge"
          style={
            folder.color
              ? {
                  color: folder.color,
                  backgroundColor: `${folder.color}1a`
                }
              : undefined
          }
        >
          {folderIconGlyph}
        </span>
      ) : folder.color ? (
        renderColorSwatch(folder.color)
      ) : null}
      <span className="folder-label-text">{folder.name}</span>
      {folder.isHidden === true ? (
        <span className="folder-hidden-indicator" aria-hidden="true">
          🔒
        </span>
      ) : null}
    </span>
  );
}

function renderMobileVisibilityIconButton(options: {
  ariaLabel: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ghost-button mobile-visibility-icon-button${
        options.isActive ? " mobile-visibility-icon-button-active" : ""
      }`}
      aria-label={options.ariaLabel}
      aria-pressed={options.isActive}
      title={options.ariaLabel}
      onClick={options.onClick}
    >
      <span aria-hidden="true" className="mobile-visibility-icon-glyph">
        {options.isActive ? "🔓" : "🔒"}
      </span>
    </button>
  );
}

function FolderOverviewNode({
  node,
  shouldUseMobileSidebarPanels,
  isReorderingFolders,
  openFolderActionMenuId,
  actions
}: FolderOverviewNodeProps) {
  const {
    folder,
    childNodes,
    depth,
    bookmarkCount,
    hasChildren,
    isExpanded,
    isActive,
    dropMode
  } = node;
  const isActionMenuOpen = openFolderActionMenuId === folder.id;
  const dropModeClass =
    !shouldUseMobileSidebarPanels && dropMode
      ? dropMode === "reorder"
        ? " folder-overview-trigger-drop-reorder"
        : " folder-overview-trigger-drop-move"
      : "";

  return (
    <li className="folder-overview-item">
      <div className="folder-overview-entry">
        <div
          className={`folder-overview-row${isActive ? " folder-overview-row-active" : ""}`}
          data-depth={depth}
          style={{ "--folder-overview-depth": Math.min(depth, 6) } as CSSProperties}
        >
          {hasChildren ? (
            <button
              type="button"
              className="folder-overview-disclosure"
              aria-label={`${folder.name} 폴더 ${isExpanded ? "접기" : "펼치기"}`}
              aria-expanded={isExpanded}
              onClick={() => {
                void actions.onToggleExpansion(folder.id);
              }}
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span aria-hidden="true" className="folder-overview-disclosure-spacer" />
          )}
          {!shouldUseMobileSidebarPanels ? (
            <button
              type="button"
              className="ghost-button folder-overview-handle"
              draggable
              disabled={isReorderingFolders}
              aria-label={`${folder.name} 폴더 드래그 정렬`}
              onDragStart={(event) => {
                void actions.onDragStart(folder.id, event);
              }}
              onDragEnd={() => {
                void actions.onDragEnd();
              }}
            >
              ⋮⋮
            </button>
          ) : null}
          <button
            type="button"
            className={`folder-overview-trigger${
              isActive ? " folder-overview-trigger-active" : ""
            }${dropModeClass}`}
            aria-label={`${folder.name} 폴더 보기`}
            aria-pressed={isActive}
            title={folder.name}
            onClick={() => {
              void actions.onSelect(folder);
            }}
            onDragOver={
              shouldUseMobileSidebarPanels
                ? undefined
                : (event) => {
                    void actions.onDragOver(folder, event);
                  }
            }
            onDragLeave={
              shouldUseMobileSidebarPanels
                ? undefined
                : () => {
                    void actions.onDragLeave(folder.id);
                  }
            }
            onDrop={
              shouldUseMobileSidebarPanels
                ? undefined
                : (event) => {
                    void actions.onDrop(folder, event);
                  }
            }
          >
            <span className="folder-overview-copy">
              {renderFolderOverviewNodeLabel(folder)}
            </span>
            <span className="folder-overview-count">{bookmarkCount}</span>
          </button>
          {shouldUseMobileSidebarPanels ? (
            <div className="folder-overview-mobile-actions">
              <button
                type="button"
                className="secondary-button folder-overview-child-create folder-overview-child-create-compact"
                aria-label={`${folder.name} 하위 폴더 추가`}
                title="하위 폴더 추가"
                onClick={() => {
                  void actions.onBeginChildCreate(folder);
                }}
              >
                +
              </button>
              <button
                type="button"
                className="secondary-button folder-overview-mobile-edit"
                aria-label={`${folder.name} 폴더 수정`}
                onClick={() => {
                  void actions.onBeginEdit(folder);
                }}
              >
                편집
              </button>
            </div>
          ) : (
            <div className="folder-overview-inline-actions folder-overview-inline-actions-visible">
              <button
                type="button"
                className="secondary-button folder-overview-child-create"
                aria-label={`${folder.name} 하위 폴더 추가`}
                title="하위 폴더 추가"
                onClick={() => {
                  void actions.onBeginChildCreate(folder);
                }}
              >
                +
              </button>
              <div
                className="folder-action-menu-shell folder-overview-menu-shell"
                data-open-menu-shell={isActionMenuOpen ? "true" : undefined}
              >
                <button
                  type="button"
                  className="ghost-button folder-action-trigger overflow-trigger"
                  aria-label={`${folder.name} 폴더 더보기`}
                  aria-expanded={isActionMenuOpen}
                  onClick={() => {
                    void actions.onToggleActionMenu(folder.id);
                  }}
                >
                  ...
                </button>
                {isActionMenuOpen ? (
                  <div
                    role="menu"
                    aria-label={`${folder.name} 폴더 메뉴`}
                    className="folder-action-menu"
                  >
                    <button
                      type="button"
                      className="secondary-button folder-action-menu-item"
                      aria-label={`${folder.name} 하위 폴더 추가`}
                      onClick={() => {
                        void actions.onBeginChildCreate(folder);
                      }}
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      className="secondary-button folder-action-menu-item"
                      aria-label={`${folder.name} 폴더 수정`}
                      onClick={() => {
                        void actions.onBeginEdit(folder);
                      }}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="danger-button folder-action-menu-item"
                      aria-label={`${folder.name} 폴더 삭제`}
                      onClick={() => {
                        void actions.onDelete(folder);
                      }}
                    >
                      삭제
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
        {hasChildren && isExpanded ? (
          <ul className="folder-overview-children">
            {childNodes.map((childNode) => (
              <MemoizedFolderOverviewNode
                key={childNode.folder.id}
                node={childNode}
                shouldUseMobileSidebarPanels={shouldUseMobileSidebarPanels}
                isReorderingFolders={isReorderingFolders}
                openFolderActionMenuId={openFolderActionMenuId}
                actions={actions}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

const MemoizedFolderOverviewNode = memo(FolderOverviewNode);

function renderFolderOverviewSystemItem(options: {
  filter: FolderOverviewSpecialFilter;
  label: string;
  ariaLabel: string;
  icon: string;
  count: number;
  hint?: string;
  activeSpecialFilter: FolderOverviewSpecialFilter | null;
  onSelect: (filter: FolderOverviewSpecialFilter) => FolderOverviewActionResult;
}) {
  const isActive = options.activeSpecialFilter === options.filter;

  return (
    <li className="folder-overview-system-item">
      <button
        type="button"
        className={`folder-overview-system-trigger${
          isActive ? " folder-overview-system-trigger-active" : ""
        }`}
        aria-label={options.ariaLabel}
        aria-pressed={isActive}
        onClick={() => void options.onSelect(options.filter)}
      >
        <span aria-hidden="true" className="folder-overview-system-icon">
          {options.icon}
        </span>
        <span className="folder-overview-system-copy">
          <span className="folder-overview-system-label">{options.label}</span>
          {options.hint ? (
            <span className="folder-overview-system-hint">{options.hint}</span>
          ) : null}
        </span>
        <span className="folder-overview-system-count">{options.count}</span>
      </button>
    </li>
  );
}

export function FolderOverviewPanel({
  activeSpecialFilter,
  allBookmarkCount,
  allSystemItemAriaLabel = "모든 북마크 보기",
  allSystemItemIcon = "☁",
  allSystemItemLabel = "모든 북마크",
  contentLabel = "북마크",
  isAllFolderViewActive,
  isHidden,
  isReorderingFolders,
  nodes,
  openFolderActionMenuId,
  query,
  shouldUseMobileSidebarPanels,
  showAllSystemItem = true,
  showHiddenFolders,
  showHiddenFolderToggle = true,
  showTrashSystemItem = true,
  trashBookmarkCount,
  unfiledBookmarkCount,
  actions,
  onCollapseAll,
  onExpandAll,
  onQueryChange,
  onReset,
  onSelectSpecialFilter,
  onToggleHiddenFolders
}: FolderOverviewPanelProps) {
  return (
    <section
      aria-label="folder-overview"
      className={`surface-card panel-card folder-overview-card${
        isHidden ? " dashboard-panel-visually-hidden" : ""
      }`}
    >
      <header className="folder-overview-header">
        {!shouldUseMobileSidebarPanels ? (
          <p className="bookmark-list-kicker">구조 둘러보기</p>
        ) : null}
        <div
          className={`folder-overview-title-row${
            shouldUseMobileSidebarPanels ? " mobile-visibility-title-row" : ""
          }`}
        >
          <div className="bookmark-list-heading-copy">
            <h2>폴더</h2>
          </div>
          {shouldUseMobileSidebarPanels && showHiddenFolderToggle
            ? renderMobileVisibilityIconButton({
                ariaLabel: showHiddenFolders ? "숨김 폴더 숨기기" : "숨김 폴더 보기",
                isActive: showHiddenFolders,
                onClick: () => void onToggleHiddenFolders()
              })
            : null}
          {!shouldUseMobileSidebarPanels ? (
            <div className="folder-overview-controls">
              {showHiddenFolderToggle ? (
                <button
                  type="button"
                  className="ghost-button folder-overview-reset-button folder-overview-lock-button"
                  aria-label={showHiddenFolders ? "숨김 폴더 숨기기" : "숨김 폴더 보기"}
                  aria-pressed={showHiddenFolders}
                  onClick={() => void onToggleHiddenFolders()}
                >
                  <span aria-hidden="true">{showHiddenFolders ? "🔓" : "🔒"}</span>
                </button>
              ) : null}
              <button
                type="button"
                className="ghost-button folder-overview-reset-button"
                aria-label="폴더 전부 펼치기"
                onClick={() => void onExpandAll()}
              >
                펼치기
              </button>
              <button
                type="button"
                className="ghost-button folder-overview-reset-button"
                aria-label="폴더 모두 접기"
                onClick={() => void onCollapseAll()}
              >
                접기
              </button>
              <button
                type="button"
                className="ghost-button folder-overview-reset-button"
                aria-label="전체 폴더 보기"
                aria-pressed={isAllFolderViewActive}
                onClick={() => void onReset()}
              >
                전체
              </button>
            </div>
          ) : null}
        </div>
        <p className="folder-overview-helper">
          {shouldUseMobileSidebarPanels
            ? `폴더를 누르면 해당 ${contentLabel}를 바로 봅니다.`
            : "범위를 바로 바꿉니다."}
        </p>
        <input
          type="search"
          className="folder-overview-search-input"
          placeholder="폴더 찾기"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </header>
      <ul className="folder-overview-system-list" aria-label="folder-system-list">
        {showAllSystemItem
          ? renderFolderOverviewSystemItem({
              filter: "all",
              label: allSystemItemLabel,
              ariaLabel: allSystemItemAriaLabel,
              icon: allSystemItemIcon,
              count: allBookmarkCount,
              activeSpecialFilter,
              onSelect: onSelectSpecialFilter
            })
          : null}
        {renderFolderOverviewSystemItem({
          filter: "unfiled",
          label: "미분류",
          ariaLabel: "미분류 보기",
          icon: "▱",
          count: unfiledBookmarkCount,
          activeSpecialFilter,
          onSelect: onSelectSpecialFilter
        })}
        {showTrashSystemItem
          ? renderFolderOverviewSystemItem({
              filter: "trash",
              label: "휴지통",
              ariaLabel: "휴지통 보기",
              icon: "⌫",
              count: trashBookmarkCount,
              activeSpecialFilter,
              onSelect: onSelectSpecialFilter
            })
          : null}
      </ul>
      {nodes.length === 0 ? (
        <p className="quiet-empty-state folder-overview-empty-state">
          {showHiddenFolders ? "폴더가 없습니다." : "보이는 폴더가 없습니다."}
        </p>
      ) : (
        <ul className="folder-overview-list">
          {nodes.map((node) => (
            <MemoizedFolderOverviewNode
              key={node.folder.id}
              node={node}
              shouldUseMobileSidebarPanels={shouldUseMobileSidebarPanels}
              isReorderingFolders={isReorderingFolders}
              openFolderActionMenuId={openFolderActionMenuId}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function MobileSidebarTabs({
  activePanel,
  items,
  onSelectPanel,
  onPreloadPanel
}: MobileSidebarTabsProps) {
  return (
    <div className="sidebar-segmented-panels">
      <div role="tablist" aria-label="mobile-sidebar-tabs" className="sidebar-segment-tabs">
        {items.map((item) => {
          const isSelected = activePanel === item.panelId;
          const panelId = `sidebar-panel-${item.panelId}`;

          return (
            <button
              key={item.panelId}
              type="button"
              role="tab"
              id={`sidebar-tab-${item.panelId}`}
              className={`sidebar-segment-tab${isSelected ? " sidebar-segment-tab-active" : ""}`}
              aria-label={item.heading}
              aria-selected={isSelected}
              aria-controls={panelId}
              onMouseEnter={() => onPreloadPanel?.(item.panelId)}
              onFocus={() => onPreloadPanel?.(item.panelId)}
              onClick={() => void onSelectPanel(item.panelId)}
            >
              <span className="sidebar-segment-copy">
                <span className="sidebar-segment-kicker">{item.kicker}</span>
                <strong>{item.heading}</strong>
                <span>{item.summary}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
