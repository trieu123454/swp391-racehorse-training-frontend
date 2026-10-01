"use client";

import { useCallback, useEffect, useState } from "react";

const TAB_QUERY_PARAM = "tab";

export function useDashboardTab<T extends string>(
  allowedTabs: readonly T[],
  defaultTab: T,
): readonly [T, (tab: T) => void] {
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    const syncFromUrl = () => {
      const requestedTab = new URLSearchParams(window.location.search).get(TAB_QUERY_PARAM);
      setActiveTab(allowedTabs.find((tab) => tab === requestedTab) ?? defaultTab);
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [allowedTabs, defaultTab]);

  const selectTab = useCallback((tab: T) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    const currentTab = url.searchParams.get(TAB_QUERY_PARAM);

    if (currentTab === tab || (!currentTab && tab === defaultTab)) return;
    if (tab === defaultTab) url.searchParams.delete(TAB_QUERY_PARAM);
    else url.searchParams.set(TAB_QUERY_PARAM, tab);

    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [defaultTab]);

  return [activeTab, selectTab] as const;
}
