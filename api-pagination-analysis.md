# Jules API Pagination & Chat UI Analysis

## The Disconnect

There is a fundamental mismatch between the Jules API's sequential nature and the desired "Chat-style" User Interface.

### API Behavior

- **Ordering**: The API returns activities in **chronological order** (Oldest $\rightarrow$ Newest).
- **Pagination**: The `nextPageToken` acts as a "forward" pointer (a timestamp). Using it fetches the next batch of _newer_ items.
- **Directionality**: The API is designed to be read from the beginning of time forward. It does not natively support "jumping to the end" or "scrolling backwards" from a given point without prior knowledge of the token sequence.

### UI Requirements (Chat-style)

- **Initial View**: The user should start at the **bottom** of the conversation (the Most Recent items).
- **Discovery**: As the user scrolls **up**, the app should fetch **older** activities.
- **Flow**: New messages should appear at the bottom.

## The Problem

To show the latest messages first in a long conversation, the client would theoretically have to:

1. Fetch the first page (oldest).
2. Follow every `nextPageToken` until it reaches the end.
3. Only then can it display the "bottom" to the user.

This is inefficient and results in long loading times for established sessions.

## The Proposed Solution: Client-Side State Persistence

To bridge this gap, we will implement a local cache of the session's pagination structure.

### 1. localStorage Metadata

We will store a mapping for each session in `localStorage`:

```typescript
interface SessionMetadata {
  headToken: string; // The most recently encountered nextPageToken
  tokenHistory: string[]; // A sequence of tokens to allow "backward" navigation
  lastUpdate: number; // Timestamp of last fetch
}
```

### 2. Loading Strategy

- **Initial Load**: Check `localStorage`.
  - **If found**: Jump to the `headToken` to show recent items immediately.
  - **If not found**: Start from the beginning (oldest) and auto-fetch forward until the end is reached (to build the initial map).
- **Catch-up**: Once at the `headToken`, the app will continue to poll/fetch forward to ensure any messages sent from other clients or the agent are captured.
- **Scrolling Up (Older Items)**: Since the API only goes forward, we will use the `tokenHistory` to "look back". If the user is at token index `N`, scrolling up will trigger a load of token index `N-1`.

### 3. Implementation Plan

- Create a `SessionStateService` to manage the `localStorage` interactions.
- Modify `SessionView` to use the cached tokens for initial positioning.
- Implement "Forward Catch-up" logic to reach the true end of the conversation.
- Implement "Backward loading" using the cached token sequence.
