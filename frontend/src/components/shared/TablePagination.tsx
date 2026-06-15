"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export default function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: TablePaginationProps) {
  if (totalPages <= 1 && totalItems <= pageSize) return null;

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const showMax = 5;
    
    if (totalPages <= showMax) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      
      if (currentPage < totalPages - 2) pages.push("...");
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-2">
      {/* Status Info */}
      <div className="text-xs text-gray-400">
        Showing <span className="text-white font-medium">{startIdx}</span> to{" "}
        <span className="text-white font-medium">{endIdx}</span> of{" "}
        <span className="text-white font-medium">{totalItems}</span> entries
      </div>

      <div className="flex items-center gap-4">
        {/* Page Size Select */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-secondary-500/50"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-primary-900">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all"
            title="First Page"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all"
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((p, idx) => (
              <button
                key={idx}
                onClick={() => typeof p === "number" && onPageChange(p)}
                disabled={p === "..."}
                className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                  p === currentPage
                    ? "bg-secondary-500 text-primary-950 shadow-lg shadow-secondary-500/20"
                    : p === "..."
                    ? "text-gray-600 cursor-default"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all"
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all"
            title="Last Page"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
