/**
 * Project Search Bar Component
 *
 * Search input with status filter and sort options.
 */

import { useCallback, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

export type ProjectStatus =
  | 'all'
  | 'draft'
  | 'rendering'
  | 'completed'
  | 'failed'
export type SortBy = 'updatedAt' | 'createdAt' | 'name'
export type SortOrder = 'asc' | 'desc'

interface ProjectSearchBarProps {
  query: string
  onQueryChange: (query: string) => void
  status: ProjectStatus
  onStatusChange: (status: ProjectStatus) => void
  sortBy: SortBy
  onSortByChange: (sortBy: SortBy) => void
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'rendering', label: 'Rendering' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'updatedAt', label: 'Last Modified' },
  { value: 'createdAt', label: 'Date Created' },
  { value: 'name', label: 'Name' },
]

export function ProjectSearchBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: ProjectSearchBarProps) {
  const [inputValue, setInputValue] = useState(query)

  // Debounce search input
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value)
      // Simple debounce - in production you might use a proper debounce hook
      const timeoutId = setTimeout(() => {
        onQueryChange(value)
      }, 300)
      return () => clearTimeout(timeoutId)
    },
    [onQueryChange],
  )

  const clearSearch = () => {
    setInputValue('')
    onQueryChange('')
  }

  const hasActiveFilters = status !== 'all' || query.length > 0

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search projects..."
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {inputValue && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status Filter - visible on tablet and up */}
      <div className="hidden sm:block">
        <Select
          value={status}
          onValueChange={(v) => onStatusChange(v as ProjectStatus)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sort Dropdown - visible on tablet and up */}
      <div className="hidden sm:block">
        <Select
          value={sortBy}
          onValueChange={(v) => onSortByChange(v as SortBy)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sort Order Toggle - visible on tablet and up */}
      <Button
        variant="outline"
        size="icon"
        className="hidden sm:flex"
        onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
        title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sortOrder === 'asc' ? '↑' : '↓'}
      </Button>

      {/* Mobile Filter Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="relative sm:hidden">
            <SlidersHorizontal className="h-4 w-4" />
            {hasActiveFilters && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onStatusChange(option.value)}
              className={status === option.value ? 'bg-accent' : ''}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Sort By</DropdownMenuLabel>
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onSortByChange(option.value)}
              className={sortBy === option.value ? 'bg-accent' : ''}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')
            }
          >
            Order: {sortOrder === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
