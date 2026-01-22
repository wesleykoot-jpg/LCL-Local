import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Search, User } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface UserPickerProps {
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function UserPicker({
  selectedIds,
  onChange,
  placeholder = 'Search for friends...',
  multiple = true,
}: UserPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load selected profiles on mount or when selectedIds change
  useEffect(() => {
    const loadSelectedProfiles = async () => {
      if (selectedIds.length === 0) {
        setSelectedProfiles([]);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', selectedIds);

      if (!error && data) {
        setSelectedProfiles(data);
      }
    };

    loadSelectedProfiles();
  }, [selectedIds]);

  // Search profiles when query changes
  useEffect(() => {
    const searchProfiles = async () => {
      if (!debouncedSearch.trim()) {
        setProfiles([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .or(
            `full_name.ilike.%${debouncedSearch}%`
          )
          .limit(10);

        if (!error && data) {
          // Filter out already selected profiles
          const filtered = data.filter((p) => !selectedIds.includes(p.id));
          setProfiles(filtered);
        }
      } catch (error) {
        console.error('Error searching profiles:', error);
      } finally {
        setLoading(false);
      }
    };

    searchProfiles();
  }, [debouncedSearch, selectedIds]);

  const handleSelectProfile = (profile: Profile) => {
    if (!multiple) {
      onChange([profile.id]);
      setSelectedProfiles([profile]);
      setSearchQuery('');
      setShowDropdown(false);
      return;
    }

    if (!selectedIds.includes(profile.id)) {
      onChange([...selectedIds, profile.id]);
      setSelectedProfiles([...selectedProfiles, profile]);
    }
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleRemoveProfile = (profileId: string) => {
    onChange(selectedIds.filter((id) => id !== profileId));
    setSelectedProfiles(selectedProfiles.filter((p) => p.id !== profileId));
  };

  const getDisplayName = (profile: Profile) => {
    return profile.full_name || 'Unknown User';
  };

  return (
    <div className="space-y-3">
      {/* Selected profiles chips */}
      {selectedProfiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedProfiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full text-sm"
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={getDisplayName(profile)}
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <User size={16} className="text-zinc-500" />
              )}
              <span className="text-zinc-900 font-medium">
                {getDisplayName(profile)}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveProfile(profile.id)}
                className="hover:bg-zinc-200 rounded-full p-0.5 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none"
          />
        </div>

        {/* Dropdown results */}
        {showDropdown && searchQuery && (
          <div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
            ) : profiles.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No users found
              </div>
            ) : (
              <div className="py-1">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleSelectProfile(profile)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={getDisplayName(profile)}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                        <User size={18} className="text-zinc-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-900 truncate">
                        {getDisplayName(profile)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}
