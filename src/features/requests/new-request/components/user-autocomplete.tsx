import { useState } from 'react';
import { ChevronsUpDown, User as UserIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useUsers } from '@/lib/db/hooks/use-users';
import type { User } from '@/data/types';

interface UserAutocompleteProps {
  /** Currently selected user id, if any. */
  selectedId?: string;
  /** User ids to exclude from the list (e.g. the requester themselves). */
  excludeIds?: string[];
  placeholder?: string;
  onSelect: (user: User) => void;
}

/**
 * Type-ahead picker over the internal user directory. Used to choose a
 * beneficiary ("buying for someone else"). The external supplier user is never
 * a valid beneficiary, so it is filtered out.
 */
export function UserAutocomplete({ selectedId, excludeIds = [], placeholder = 'Type a name…', onSelect }: UserAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const { data: users = [] } = useUsers();
  const exclude = new Set([...excludeIds]);
  const options = users.filter((u) => u.role !== 'supplier' && !exclude.has(u.id));
  const selected = users.find((u) => u.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selected ? selected.name : placeholder}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              {options.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.name}
                  onSelect={() => {
                    onSelect(u);
                    setOpen(false);
                  }}
                >
                  <UserIcon className="size-4 text-gray-400" />
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-medium">{u.name}</span>
                      <span className="ml-2 text-xs text-gray-400">{u.department}</span>
                    </div>
                    {u.country && <span className="shrink-0 text-xs text-gray-400">{u.country}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
