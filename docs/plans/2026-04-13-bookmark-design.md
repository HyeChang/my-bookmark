# Bookmark Service Design

## Overview

This document defines the approved MVP design for a bookmark service whose final target is:

- a responsive web app that works on PC, mobile, and tablet
- a later Chrome extension that reuses the same backend and account system

The service must be operable with zero fixed monthly cost for the initial release, while remaining usable from outside the local network.

## Product Goals

- Support authenticated bookmark usage through Google login
- Allow bookmark organization with folders, favorites, tags, colors, and icons
- Provide search across bookmark content with dedicated search modes
- Support bookmark recommendation based on usage behavior
- Support automatic metadata and content extraction from URLs where possible
- Allow users to manually provide title, content, summary, and captured images during bookmark creation
- Preserve automatic extraction data in the background while prioritizing user-entered values in the UI

## Non-Goals For MVP

- Native mobile apps
- Guaranteed content extraction for every website
- Universal comment summarization across all websites
- Paid AI summarization
- Browser extension in the first release

## Platform And Stack

### Frontend

- React + TypeScript
- Responsive PWA UI for desktop, tablet, and mobile
- Single web origin for UI and API consumption

### Backend

- Cloudflare Workers for API and authenticated server logic
- Cloudflare D1 for relational application data
- Cloudflare R2 for uploaded images and captured assets

### Authentication

- Google OAuth login
- Worker-managed session cookies

## Why This Architecture

The selected architecture is optimized for:

- free-first deployment and operation
- simple shared backend reuse between the future web app and Chrome extension
- relational modeling for folders, tags, favorites, recommendation signals, and search behavior
- avoiding a separate always-on JVM server

Java/JPA was explicitly considered and rejected for the MVP because it raises deployment and operations complexity under the zero-fixed-cost constraint.

## Core User Flows

### 1. Bookmark Creation

The bookmark creation screen allows the user to perform all of the following in one flow:

- enter a URL
- request automatic preview/extraction
- manually enter title
- manually enter full content or notes
- manually enter a summary
- upload a capture image or supporting images
- choose a folder
- assign tags
- mark as favorite
- set bookmark color and URL color

After save:

- the bookmark record is created immediately
- automatic extraction continues in the background when applicable
- user-entered values remain the primary displayed values

### 2. Bookmark Editing

Users can update existing bookmarks after creation, including:

- title
- content
- summary
- images
- folder
- tags
- favorite status
- bookmark color
- URL color

Users can also:

- retry automatic extraction
- reset user-entered fields back to automatic values if desired

### 3. Search

The service supports multiple search modes:

- default integrated search: title + content + tags
- title-only search
- content-only search
- folder-name search

The default search explicitly excludes:

- raw URL matching
- folder name matching

Folder name search is available as a separate mode.

### 4. Recommendation

MVP recommendations are rule-based, not AI-based. Signals include:

- recent access
- frequent access
- favorite status
- current folder context
- current tag context

The initial recommendation groups are:

- frequently used
- recently viewed
- related in this folder or tag context

## Content Model

Each bookmark stores both automatic and user-provided content fields.

### Automatic Fields

- `source_title`
- `source_content`
- `source_summary`
- `source_description`
- `source_thumbnail_url`

### User Fields

- `user_title`
- `user_content`
- `user_summary`

### Display Rules

The UI always resolves display values in this order:

- `display_title = user_title ?? source_title`
- `display_content = user_content ?? source_content`
- `display_summary = user_summary ?? source_summary`

This means:

- automatic extraction output is preserved
- user edits are never silently overwritten
- later re-extraction updates only the background source fields

## Data Model

The relational MVP model includes at least the following tables.

### `users`

- account identity
- Google account reference
- timestamps

### `sessions`

- session token hash
- `user_id`
- expiration
- timestamps

### `folders`

- `user_id`
- name
- color
- icon
- parent folder id
- sort order
- timestamps

### `bookmarks`

- `user_id`
- `folder_id`
- url
- normalized url
- favorite flag
- bookmark color
- URL color
- source fields
- user fields
- extraction status
- summary status
- timestamps

### `tags`

- `user_id`
- name
- color
- timestamps

### `bookmark_tags`

- `bookmark_id`
- `tag_id`

### `bookmark_assets`

- `bookmark_id`
- `user_id`
- asset type
- object key
- mime type
- width
- height
- sort order
- timestamps

### `bookmark_activity`

- `bookmark_id`
- `user_id`
- viewed/opened event type
- occurred at

### `bookmark_extraction_logs`

- `bookmark_id`
- last attempted at
- success flag
- failure reason
- extractor source

## Search Design

### Search Storage Strategy

- D1 stores the source-of-truth relational data
- SQLite FTS is used for bookmark search indexing
- folder name queries use a dedicated folder query path rather than the bookmark FTS path

### Search Modes

- integrated search: title + content + tags
- title search: title only
- content search: content only
- folder search: folder name only

### Search Inputs

The integrated search uses:

- effective title
- effective content
- tag text

It does not use:

- raw URL
- folder name

### Filtering

The UI also supports filters such as:

- favorite only
- specific tag
- specific folder scope
- recent additions
- recent visits
- summary exists / missing

## Extraction Strategy

The system follows a progressive extraction model:

### Level 1

- title
- OG/meta description
- OG image

### Level 2

- full text extraction for accessible public pages

### Level 3

- lightweight free summarization based on extracted text

### Fallback Behavior

If extraction fails:

- bookmark creation still succeeds
- available metadata is preserved
- user-entered content remains usable

This design explicitly does not promise successful extraction on every website.

## Comment Summary Scope

Comment summarization is limited in MVP.

- no claim of universal support
- only explicitly supported sources may expose comment summary later
- unsupported sources should clearly show an unavailable status instead of failing silently

## Upload Strategy

User-uploaded images and capture images are stored separately from bookmark text data.

### Storage Split

- D1 stores bookmark and asset metadata
- R2 stores the binary files

### Upload Flow

- client requests an upload URL from the Worker
- Worker returns a signed upload target
- client uploads directly to R2
- Worker records resulting asset metadata in D1

This keeps large file transfer out of the Worker execution path and supports later reuse from the Chrome extension.

## Authentication And Security

- Google login only for MVP
- HttpOnly session cookies issued by the Worker
- per-user data isolation on every bookmark, folder, tag, and asset query
- authenticated upload signing only
- ownership checks on edit, delete, extract retry, and asset operations

## Duplicate URL Handling

When a user saves a URL that already exists in their own account:

- the UI warns about duplication
- the user can open the existing bookmark or save another entry intentionally

Duplicate handling is scoped per user.

## Error Handling Principles

### Extraction Failure

- save bookmark anyway
- mark extraction status as failed
- allow retry later

### Upload Failure

- keep bookmark text data saved
- let the user retry asset upload independently

### Unsupported Comment Sources

- show unsupported status explicitly

## MVP Deliverables

The first release includes:

- Google login
- folder management
- favorites
- tags
- bookmark colors and folder colors/icons
- integrated search
- title/content/folder-name search modes
- recommendation blocks
- automatic extraction where possible
- manual title/content/summary entry
- image upload
- full post-save edit flow

## Future Phase

The next major phase after the web MVP is:

- Chrome extension integration

The extension should reuse:

- the same login/account model
- the same bookmark creation API
- the same upload flow
- the same bookmark display model
