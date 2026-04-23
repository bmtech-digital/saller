import { useState, useEffect, useRef } from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import type { ProposalBlock as BlockType } from '../../types';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

interface ProposalBlockProps {
  block: BlockType;
  onUpdate: (blockId: string, data: Partial<BlockType>) => void;
  onDelete: (blockId: string) => void;
  onAddTextItem: (blockId: string, content: string) => void;
  onUpdateTextItem: (textItemId: string, content: string) => void;
}

export function ProposalBlock({
  block,
  onUpdate,
  onDelete,
  onAddTextItem,
  onUpdateTextItem,
}: ProposalBlockProps) {
  // Local state for debounced fields
  const [localTitle, setLocalTitle] = useState(block.title);
  const [localPrice, setLocalPrice] = useState(block.unit_price);
  const [localDescription, setLocalDescription] = useState(
    block.text_items?.[0]?.content || ''
  );

  // Debounced values
  const debouncedTitle = useDebounce(localTitle, 500);
  const debouncedPrice = useDebounce(localPrice, 500);
  const debouncedDescription = useDebounce(localDescription, 500);

  // Track if this is the initial mount
  const isFirstRender = useRef(true);
  const isFirstDescRender = useRef(true);

  // Sync local state when block prop changes (e.g., from server)
  useEffect(() => {
    setLocalTitle(block.title);
    setLocalPrice(block.unit_price);
    setLocalDescription(block.text_items?.[0]?.content || '');
  }, [block.id]);

  // Send updates when debounced values change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debouncedTitle !== block.title) {
      onUpdate(block.id, { title: debouncedTitle });
    }
  }, [debouncedTitle]);

  useEffect(() => {
    if (debouncedPrice !== block.unit_price) {
      onUpdate(block.id, { unit_price: debouncedPrice });
    }
  }, [debouncedPrice]);

  // Save description (single text item per block)
  useEffect(() => {
    if (isFirstDescRender.current) {
      isFirstDescRender.current = false;
      return;
    }
    const existingItem = block.text_items?.[0];
    if (existingItem) {
      if (debouncedDescription !== existingItem.content) {
        onUpdateTextItem(existingItem.id, debouncedDescription);
      }
    } else if (debouncedDescription.trim()) {
      onAddTextItem(block.id, debouncedDescription.trim());
    }
  }, [debouncedDescription]);

  return (
    <div className="bg-white border border-dark-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-dark-50 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between border-b border-dark-200 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <GripVertical className="w-5 h-5 text-dark-400 cursor-grab flex-shrink-0 hidden sm:block" />
          <input
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            placeholder="הוסף כותרת"
            className="font-semibold text-dark-900 bg-transparent border-none focus:outline-none focus:ring-0 text-base sm:text-lg w-full min-w-0"
          />
        </div>
        <button
          onClick={() => onDelete(block.id)}
          className="p-2 rounded-lg hover:bg-red-100 text-dark-400 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Description */}
        <textarea
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          placeholder="הוסף תיאור..."
          className="w-full px-3 py-2 border border-dark-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[60px]"
        />

        {/* Price */}
        <div className="pt-4 border-t border-dark-200">
          <div className="max-w-xs">
            <label className="block text-xs sm:text-sm font-medium text-dark-700 mb-1.5">
              עלות
            </label>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 text-sm">₪</span>
              <input
                type="number"
                value={localPrice}
                onChange={(e) => setLocalPrice(parseFloat(e.target.value) || 0)}
                className="w-full pr-8 pl-2 sm:pl-4 py-2 sm:py-2.5 text-sm sm:text-base border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                min="0"
                step="0.01"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
