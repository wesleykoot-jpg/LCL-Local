import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { MapPin, User, Check } from 'lucide-react';
import { updateProfileSchema, sanitizeInput } from '../lib/validation';

export function ProfileSetupView() {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [persona, setPersona] = useState<'family' | 'gamer'>('family');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'pending'>('pending');

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user]);

  const requestLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLocationPermission('pending');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationPermission('granted');
        const { latitude, longitude } = position.coords;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();

          if (data.address) {
            setLocationCity(data.address.city || data.address.town || data.address.village || '');
            setLocationCountry(data.address.country || '');
          }
        } catch (err) {
          console.error('Error reverse geocoding:', err);
          setError('Could not determine your location. Please enter manually.');
        }
      },
      (error) => {
        setLocationPermission('denied');
        setError('Location permission denied. Please enter your location manually.');
        console.error('Geolocation error:', error);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate and sanitize input data
      const validatedData = updateProfileSchema.parse({
        full_name: sanitizeInput(fullName),
        location_city: locationCity ? sanitizeInput(locationCity) : null,
        location_country: locationCountry ? sanitizeInput(locationCountry) : null,
        current_persona: persona,
        profile_complete: true,
      });

      const { error: updateError } = await updateProfile(validatedData);

      if (updateError) {
        throw updateError;
      }
    } catch (error) {
      console.error('Profile update error:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to update profile. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          <div className="text-center mb-8">
            <div className="inline-block bg-[#B4FF39] rounded-2xl px-6 py-3 mb-4">
              <h1 className="text-3xl font-bold text-zinc-900">LCL</h1>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Complete Your Profile</h2>
            <p className="text-zinc-400">Let's set up your local social network profile</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#B4FF39] focus:border-transparent disabled:opacity-50"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Location</label>

              {locationPermission === 'pending' && (
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl mb-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <MapPin size={20} />
                  Use My Current Location
                </button>
              )}

              {locationPermission === 'granted' && (
                <div className="mb-3 p-3 bg-green-500/20 border border-green-500/50 rounded-xl text-green-200 text-sm flex items-center gap-2">
                  <Check size={16} />
                  Location detected successfully
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="text"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    disabled={loading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#B4FF39] focus:border-transparent disabled:opacity-50"
                    placeholder="City"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={locationCountry}
                    onChange={(e) => setLocationCountry(e.target.value)}
                    disabled={loading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#B4FF39] focus:border-transparent disabled:opacity-50"
                    placeholder="Country"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                This helps us show you relevant local events
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">Choose Your Persona</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPersona('family')}
                  disabled={loading}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    persona === 'family'
                      ? 'bg-[#B4FF39]/20 border-[#B4FF39] text-white'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/30'
                  } disabled:opacity-50`}
                >
                  <div className="text-4xl mb-2">👨‍👩‍👧‍👦</div>
                  <div className="font-bold">Family</div>
                  <div className="text-xs mt-1">Local events & community</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPersona('gamer')}
                  disabled={loading}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    persona === 'gamer'
                      ? 'bg-[#B4FF39]/20 border-[#B4FF39] text-white'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/30'
                  } disabled:opacity-50`}
                >
                  <div className="text-4xl mb-2">🎮</div>
                  <div className="font-bold">Gamer</div>
                  <div className="text-xs mt-1">Gaming & esports</div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#B4FF39] hover:bg-[#a3ed28] text-zinc-900 font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg mt-8"
            >
              {loading ? (
                <div className="w-5 h-5 border-3 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Check size={20} />
                  Complete Setup
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
