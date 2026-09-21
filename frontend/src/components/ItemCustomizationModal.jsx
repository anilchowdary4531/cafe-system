import { useState, useMemo, useEffect } from "react";
import { X, Plus, Minus, AlertCircle, CheckCircle2 } from "lucide-react";
import { resolveImageUrl } from "../utils/resolveImageUrl";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";

export default function ItemCustomizationModal({
  isOpen,
  item,
  initialConfig = null,
  onSave,
  onClose,
}) {
  if (!isOpen || !item) return null;

  const variants = useMemo(
    () => (Array.isArray(item.variants) ? item.variants.filter((v) => v.isActive !== false) : []),
    [item.variants]
  );

  const modifierGroups = useMemo(
    () => (Array.isArray(item.modifierGroups) ? item.modifierGroups : []),
    [item.modifierGroups]
  );

  // Default Variant Selection
  const initialVariant = useMemo(() => {
    if (initialConfig?.variant) return initialConfig.variant;
    if (initialConfig?.variantId) {
      const match = variants.find((v) => v.id === initialConfig.variantId);
      if (match) return match;
    }
    if (variants.length > 0) {
      return variants.find((v) => v.isDefault) || variants[0];
    }
    return null;
  }, [initialConfig, variants]);

  const [selectedVariant, setSelectedVariant] = useState(initialVariant);

  // Selected Modifiers Map: { [groupId]: [ { modifierId, name, price } ] }
  const [selectedModifiersMap, setSelectedModifiersMap] = useState(() => {
    if (initialConfig?.selectedModifiers && Array.isArray(initialConfig.selectedModifiers)) {
      const map = {};
      initialConfig.selectedModifiers.forEach((mod) => {
        const gid = mod.modifierGroupId;
        if (!map[gid]) map[gid] = [];
        map[gid].push(mod);
      });
      return map;
    }
    // Default selections for required groups with minSelect = 1 and maxSelect = 1
    const defaultMap = {};
    modifierGroups.forEach((g) => {
      const opts = Array.isArray(g.modifiers) ? g.modifiers.filter((m) => m.isAvailable !== false) : [];
      if (g.isRequired && g.minSelect === 1 && g.maxSelect === 1 && opts.length > 0) {
        defaultMap[g.id] = [{
          modifierGroupId: g.id,
          groupName: g.name,
          modifierId: opts[0].id,
          name: opts[0].name,
          price: Number(opts[0].price || 0),
        }];
      }
    });
    return defaultMap;
  });

  const [qty, setQty] = useState(() => Math.max(1, Number(initialConfig?.qty || 1)));
  const [notes, setNotes] = useState(() => String(initialConfig?.notes || ""));
  const [validationError, setValidationError] = useState("");

  // Sync state when modal opens or item changes
  useEffect(() => {
    setSelectedVariant(initialVariant);
    setQty(Math.max(1, Number(initialConfig?.qty || 1)));
    setNotes(String(initialConfig?.notes || ""));
    setValidationError("");
  }, [initialConfig, initialVariant, item]);

  // Base price calculation
  const basePrice = useMemo(() => {
    if (selectedVariant) return Number(selectedVariant.price || 0);
    return Number(item.price || 0);
  }, [item.price, selectedVariant]);

  // Sum of selected modifiers
  const modifiersTotalPrice = useMemo(() => {
    let sum = 0;
    Object.values(selectedModifiersMap).forEach((mods) => {
      if (Array.isArray(mods)) {
        mods.forEach((m) => {
          sum += Number(m.price || 0);
        });
      }
    });
    return sum;
  }, [selectedModifiersMap]);

  const unitPrice = basePrice + modifiersTotalPrice;
  const totalPrice = unitPrice * qty;

  const handleToggleModifier = (group, modifier) => {
    setValidationError("");
    const gid = group.id;
    const currentList = selectedModifiersMap[gid] || [];
    const isSingleSelect = group.maxSelect === 1;

    const isAlreadySelected = currentList.some((m) => m.modifierId === modifier.id);

    let nextList = [];
    if (isSingleSelect) {
      if (isAlreadySelected && !group.isRequired) {
        nextList = [];
      } else {
        nextList = [{
          modifierGroupId: group.id,
          groupName: group.name,
          modifierId: modifier.id,
          name: modifier.name,
          price: Number(modifier.price || 0),
        }];
      }
    } else {
      if (isAlreadySelected) {
        nextList = currentList.filter((m) => m.modifierId !== modifier.id);
      } else {
        if (group.maxSelect > 0 && currentList.length >= group.maxSelect) {
          setValidationError(`Maximum ${group.maxSelect} selection(s) allowed for '${group.name}'`);
          return;
        }
        nextList = [
          ...currentList,
          {
            modifierGroupId: group.id,
            groupName: group.name,
            modifierId: modifier.id,
            name: modifier.name,
            price: Number(modifier.price || 0),
          },
        ];
      }
    }

    setSelectedModifiersMap((prev) => ({
      ...prev,
      [gid]: nextList,
    }));
  };

  const handleConfirm = () => {
    // Validate required groups
    for (const group of modifierGroups) {
      const selectedForGroup = selectedModifiersMap[group.id] || [];
      const count = selectedForGroup.length;

      if (group.isRequired && count === 0) {
        setValidationError(`Please select an option for '${group.name}'`);
        return;
      }
      if (group.minSelect > 0 && count < group.minSelect) {
        setValidationError(`Please select at least ${group.minSelect} option(s) for '${group.name}'`);
        return;
      }
      if (group.maxSelect > 0 && count > group.maxSelect) {
        setValidationError(`Maximum ${group.maxSelect} selection(s) allowed for '${group.name}'`);
        return;
      }
    }

    // Flatten selected modifiers list
    const allSelectedModifiers = Object.values(selectedModifiersMap).flat();

    const resultPayload = {
      menuItemId: item.id,
      name: item.name,
      category: item.category,
      image: item.image,
      variant: selectedVariant
        ? { id: selectedVariant.id, name: selectedVariant.name, price: selectedVariant.price }
        : null,
      variantId: selectedVariant?.id || null,
      variantName: selectedVariant?.name || null,
      variantPrice: selectedVariant?.price || null,
      selectedModifiers: allSelectedModifiers,
      notes: notes.trim(),
      qty,
      unitPrice,
      price: unitPrice,
      totalPrice,
      cartKey: `${item.id}_${selectedVariant?.id || "def"}_${allSelectedModifiers.map((m) => m.modifierId).sort().join("-")}_${notes.trim()}`,
    };

    onSave(resultPayload);
    onClose();
  };

  const imageSrc = resolveImageUrl(item.image) || FALLBACK_IMAGE;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-card-bg,#18181b)] text-[color:var(--app-text,#f4f4f5)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="relative h-36 w-full flex-none overflow-hidden bg-zinc-900">
          <img
            src={imageSrc}
            alt={item.name}
            className="h-full w-full object-cover opacity-80"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="text-xl font-bold text-white tracking-tight">{item.name}</h2>
            {item.description && (
              <p className="text-xs text-zinc-300 line-clamp-1">{item.description}</p>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {validationError && (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs font-semibold text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Variants Section */}
          {variants.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Select Size / Portion <span className="text-rose-400">*</span>
                </h3>
                <span className="text-[11px] font-medium text-amber-400">Choose 1</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setValidationError("");
                        setSelectedVariant(v);
                      }}
                      className={`flex items-center justify-between rounded-2xl border p-3 text-left transition ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/10 text-white shadow-sm"
                          : "border-[color:var(--app-border)] bg-zinc-900/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                            isSelected ? "border-amber-400 bg-amber-400" : "border-zinc-600"
                          }`}
                        >
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                        </div>
                        <span className="text-sm font-semibold">{v.name}</span>
                      </div>
                      <span className="text-xs font-bold text-amber-300">₹{v.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modifier Groups Section */}
          {modifierGroups.map((group) => {
            const groupMods = Array.isArray(group.modifiers)
              ? group.modifiers.filter((m) => m.isAvailable !== false)
              : [];
            if (groupMods.length === 0) return null;

            const selectedForGroup = selectedModifiersMap[group.id] || [];
            const isSingleSelect = group.maxSelect === 1;

            return (
              <div key={group.id} className="space-y-3 border-t border-zinc-800/80 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      {group.name}
                    </h3>
                    {group.isRequired ? (
                      <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                        REQUIRED
                      </span>
                    ) : (
                      <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                        OPTIONAL
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-zinc-400">
                    {isSingleSelect
                      ? "Select 1"
                      : group.maxSelect > 0
                      ? `Select up to ${group.maxSelect}`
                      : "Select options"}
                  </span>
                </div>

                <div className="space-y-2">
                  {groupMods.map((mod) => {
                    const isSelected = selectedForGroup.some((m) => m.modifierId === mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => handleToggleModifier(group, mod)}
                        className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition ${
                          isSelected
                            ? "border-amber-500 bg-amber-500/10 text-white"
                            : "border-[color:var(--app-border)] bg-zinc-900/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-4 w-4 items-center justify-center border transition ${
                              isSingleSelect ? "rounded-full" : "rounded-md"
                            } ${
                              isSelected
                                ? "border-amber-400 bg-amber-400 text-black"
                                : "border-zinc-600"
                            }`}
                          >
                            {isSelected && (
                              isSingleSelect ? (
                                <div className="h-1.5 w-1.5 rounded-full bg-black" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 stroke-[3]" />
                              )
                            )}
                          </div>
                          <span className="text-sm font-medium">{mod.name}</span>
                        </div>
                        <span className="text-xs font-bold text-zinc-300">
                          {Number(mod.price) > 0 ? `+₹${mod.price}` : "Free"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Notes Input */}
          <div className="space-y-2 border-t border-zinc-800/80 pt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Special Preparation Instructions
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Less spicy, Extra crispy, No onions..."
              className="w-full rounded-2xl border border-[color:var(--app-border)] bg-zinc-900/80 px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[color:var(--app-border)] bg-zinc-950 p-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-400">Qty:</span>
            <div className="flex items-center rounded-2xl border border-zinc-700 bg-zinc-900 p-1">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-xs font-bold text-white">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-xs font-bold text-black hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/20"
          >
            <span>{initialConfig ? "Update Cart Item" : "Add to Order"}</span>
            <span>•</span>
            <span>₹{totalPrice}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
