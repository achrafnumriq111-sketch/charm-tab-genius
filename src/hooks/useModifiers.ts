import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ModifierOption {
  id: string;
  group_id: string;
  name: string;
  extra_price: number;
  cost_price: number;
  stock_sensitive: boolean;
  is_default: boolean;
  display_order: number;
  is_active: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  description: string | null;
  location_id: string | null;
  is_required: boolean;
  min_select: number;
  max_select: number;
  display_order: number;
  is_active: boolean;
  modifiers: ModifierOption[];
}

export interface ProductModifierLink {
  id: string;
  product_id: string;
  modifier_group_id: string;
}

/** Converts DB modifier groups into the legacy format used by POS/ModifierPicker */
export function toLegacyGroup(group: ModifierGroup) {
  return {
    id: group.id,
    name: group.name,
    required: group.is_required,
    multiple: group.max_select > 1,
    minSelect: group.min_select,
    maxSelect: group.max_select,
    options: (group.modifiers || [])
      .filter((m) => m.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map((m) => ({
        id: m.id,
        name: m.name,
        price: m.extra_price,
        costPrice: m.cost_price,
      })),
  };
}

export function useModifiers(locationId?: string | null) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [links, setLinks] = useState<ProductModifierLink[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    let groupsQuery = supabase.from("modifier_groups").select("*").order("display_order");
    let linksQuery = supabase.from("product_modifier_groups").select("*");
    if (locationId) {
      groupsQuery = groupsQuery.eq("location_id", locationId);
      linksQuery = linksQuery.eq("location_id", locationId);
    }
    const [groupsRes, modifiersRes, linksRes] = await Promise.all([
      groupsQuery,
      supabase.from("modifiers").select("*").order("display_order"),
      linksQuery,
    ]);

    const rawGroups = (groupsRes.data || []) as any[];
    const rawModifiers = (modifiersRes.data || []) as ModifierOption[];
    const rawLinks = (linksRes.data || []) as ProductModifierLink[];

    const merged: ModifierGroup[] = rawGroups.map((g) => ({
      ...g,
      modifiers: rawModifiers.filter((m) => m.group_id === g.id),
    }));

    setGroups(merged);
    setLinks(rawLinks);
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /** Get legacy-format modifier groups for a specific product ID */
  function getGroupsForProduct(productId: string) {
    const groupIds = links.filter((l) => l.product_id === productId).map((l) => l.modifier_group_id);
    return groups
      .filter((g) => groupIds.includes(g.id) && g.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map(toLegacyGroup);
  }

  return { groups, links, loading, refetch: fetchAll, getGroupsForProduct };
}
