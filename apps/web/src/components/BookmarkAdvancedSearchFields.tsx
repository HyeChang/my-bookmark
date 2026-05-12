import type {
  InputHTMLAttributes,
  ReactNode
} from "react";
import type {
  BookmarkRelativeDateRange,
  BookmarkTagMode,
  Folder,
  Tag
} from "@bookmark/shared";
import type { BookmarkSearchDraft } from "./BookmarkResultsPanel";
import { ColorSelectField } from "./ColorSelectField";
import { renderColorSwatch } from "./ColorSelectField";

type CheckboxFieldProps = {
  label: ReactNode;
  className?: string;
  inputProps: Omit<InputHTMLAttributes<HTMLInputElement>, "type">;
};

type FolderOption = {
  folder: Folder;
  label: string;
};

type BookmarkAdvancedSearchFieldsProps = {
  bookmarkSearchDraft: BookmarkSearchDraft;
  tags: Tag[];
  visibleFolderOptions: FolderOption[];
  toggleBookmarkSearchTag: (tagId: string, checked: boolean) => void;
  updateBookmarkSearchDraft: (patch: Partial<BookmarkSearchDraft>) => void;
};

function renderTagLabel(label: string, color: string | null | undefined, className: string) {
  return (
    <span className={className}>
      {color ? renderColorSwatch(color) : null}
      <span>{label}</span>
    </span>
  );
}

function renderCheckboxField({ label, className, inputProps }: CheckboxFieldProps) {
  const classes = ["checkbox-field", className].filter(Boolean).join(" ");
  const inputClasses = ["checkbox-field-input", inputProps.className].filter(Boolean).join(" ");

  return (
    <label className={classes}>
      <span className="checkbox-field-copy">{label}</span>
      <input {...inputProps} type="checkbox" className={inputClasses} />
    </label>
  );
}

export default function BookmarkAdvancedSearchFields({
  bookmarkSearchDraft,
  tags,
  visibleFolderOptions,
  toggleBookmarkSearchTag,
  updateBookmarkSearchDraft
}: BookmarkAdvancedSearchFieldsProps) {
  return (
    <fieldset className="search-grid search-grid-advanced search-grid-surface">
      <legend>필터</legend>
      <div className="search-filter-group">
        <h3>기간</h3>
        <div className="search-filter-group-grid">
          <label>
            최근 추가
            <select
              name="bookmarkSearchCreatedWithin"
              value={bookmarkSearchDraft.createdWithin}
              onChange={(event) =>
                updateBookmarkSearchDraft({
                  createdWithin: event.target.value as BookmarkRelativeDateRange
                })
              }
            >
              <option value="all">전체</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
            </select>
          </label>
          <label>
            최근 열람
            <select
              name="bookmarkSearchOpenedWithin"
              value={bookmarkSearchDraft.openedWithin}
              onChange={(event) =>
                updateBookmarkSearchDraft({
                  openedWithin: event.target.value as BookmarkRelativeDateRange
                })
              }
            >
              <option value="all">전체</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
            </select>
          </label>
        </div>
      </div>
      <div className="search-filter-group">
        <h3>분류</h3>
        <div className="search-filter-group-grid">
          <label>
            <span aria-hidden="true">폴더</span>
            <select
              aria-label="필터 폴더"
              name="bookmarkSearchFolderId"
              value={bookmarkSearchDraft.folderId}
              onChange={(event) =>
                updateBookmarkSearchDraft({
                  folderId: event.target.value,
                  includeDescendantFolders: event.target.value
                    ? bookmarkSearchDraft.includeDescendantFolders
                    : false
                })
              }
            >
              <option value="">전체 폴더</option>
              {visibleFolderOptions.map(({ folder, label }) => (
                <option key={folder.id} value={folder.id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {renderCheckboxField({
            className: "search-filter-checkbox",
            label: <span aria-hidden="true">하위 포함</span>,
            inputProps: {
              "aria-label": "하위 폴더 포함",
              name: "bookmarkSearchIncludeDescendantFolders",
              checked: bookmarkSearchDraft.includeDescendantFolders,
              onChange: (event) =>
                updateBookmarkSearchDraft({
                  includeDescendantFolders: event.currentTarget.checked
                }),
              disabled: !bookmarkSearchDraft.folderId
            }
          })}
          <label>
            태그 조건
            <select
              name="bookmarkSearchTagMode"
              value={bookmarkSearchDraft.tagMode}
              onChange={(event) =>
                updateBookmarkSearchDraft({
                  tagMode: event.target.value as BookmarkTagMode
                })
              }
            >
              <option value="and">모두 포함</option>
              <option value="or">하나라도 포함</option>
            </select>
          </label>
          <fieldset className="tag-fieldset">
            <legend>필터 태그</legend>
            {tags.length === 0 ? (
              <p className="quiet-empty-state">태그가 없습니다.</p>
            ) : null}
            <div className="pill-list">
              {tags.map((tag) => (
                <label key={tag.id} className="pill-option">
                  <input
                    type="checkbox"
                    name="bookmarkSearchTagIds"
                    checked={bookmarkSearchDraft.tagIds.includes(tag.id)}
                    onChange={(event) =>
                      toggleBookmarkSearchTag(tag.id, event.target.checked)
                    }
                  />
                  {renderTagLabel(tag.name, tag.color, "tag-option-label")}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
      <div className="search-filter-group">
        <h3>상태</h3>
        <div className="search-filter-group-grid">
          {renderCheckboxField({
            className: "search-filter-checkbox",
            label: <span aria-hidden="true">즐겨찾기</span>,
            inputProps: {
              "aria-label": "즐겨찾기만",
              name: "bookmarkSearchFavoriteOnly",
              checked: bookmarkSearchDraft.favoriteOnly,
              onChange: (event) =>
                updateBookmarkSearchDraft({
                  favoriteOnly: event.currentTarget.checked
                })
            }
          })}
          <ColorSelectField
            label="북마크 색상 필터"
            selectedColor={bookmarkSearchDraft.bookmarkColor}
            onSelect={(value) => updateBookmarkSearchDraft({ bookmarkColor: value })}
            emptyLabel="전체 색상"
            compact
          />
          <ColorSelectField
            label="url 색상 필터"
            selectedColor={bookmarkSearchDraft.urlColor}
            onSelect={(value) => updateBookmarkSearchDraft({ urlColor: value })}
            emptyLabel="전체 색상"
            compact
          />
          <label>
            <span aria-hidden="true">요약</span>
            <select
              aria-label="요약 필터"
              name="bookmarkSearchSummaryState"
              value={bookmarkSearchDraft.summaryState}
              onChange={(event) =>
                updateBookmarkSearchDraft({
                  summaryState: event.target.value as "all" | "with" | "without"
                })
              }
            >
              <option value="all">전체 요약</option>
              <option value="with">요약 있음</option>
              <option value="without">요약 없음</option>
            </select>
          </label>
        </div>
      </div>
    </fieldset>
  );
}
