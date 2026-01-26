import React, { useState, useEffect } from "react";
import { X, Upload, Calendar, MapPin, Clock, Lock, Users } from "lucide-react";
import { createEvent } from "../lib/eventService";
import { uploadImage, compressImage } from "../lib/storageService";
import { hapticNotification } from "../lib/haptics";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/useAuth";
import { useLocation } from "../contexts/LocationContext";
import { createEventSchema, sanitizeInput } from "../lib/validation";
import { UserPicker } from "./UserPicker";

interface CreateEventModalProps {
  onClose: () => void;
  isOpen?: boolean;
  defaultCategory?: "cinema" | "market" | "crafts" | "sports" | "gaming";
  defaultEventType?: "anchor" | "fork" | "signal";
}

export function CreateEventModal({
  onClose,
  isOpen = true,
  defaultCategory = "cinema",
  defaultEventType = "anchor",
}: CreateEventModalProps) {
  const { profile } = useAuth();
  const { location: userLocation } = useLocation();
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: defaultCategory,
    event_type: defaultEventType,
    event_date: "",
    event_time: "",
    venue_name: "",
    max_attendees: 0,
  });

  // Don't render if not open

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clean up previous preview URL
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    try {
      const compressed = await compressImage(file);
      setImageFile(compressed);
      const preview = URL.createObjectURL(compressed);
      setImagePreview(preview);
    } catch (error) {
      toast.error("Failed to process image");
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Don't render if not open
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (!userLocation) {
      toast.error("Location required. Please enable location services.");
      return;
    }

    setLoading(true);

    try {
      // Validate form data using Zod schema
      const validatedData = createEventSchema.parse({
        ...formData,
        title: sanitizeInput(formData.title),
        description: formData.description
          ? sanitizeInput(formData.description)
          : undefined,
        venue_name: sanitizeInput(formData.venue_name),
      });

      let imageUrl = "";

      if (imageFile) {
        const { url, error } = await uploadImage({
          file: imageFile,
          folder: "events",
          userId: profile.id,
        });

        if (error) throw error;
        if (url) imageUrl = url;
      }

      const { error } = await createEvent({
        ...validatedData,
        description: validatedData.description || "",
        image_url: imageUrl,
        // Use user's current location (from GPS or manual zone)
        location: `POINT(${userLocation.lng} ${userLocation.lat})`,
        creator_profile_id: profile.id,
        is_private: isPrivate,
        invited_user_ids: isPrivate ? invitedUserIds : undefined,
      });

      if (error) throw error;

      await hapticNotification("success");
      toast.success("Event created successfully!");
      onClose();
    } catch (error) {
      console.error("Error creating event:", error);
      await hapticNotification("error");

      // Better error messages for validation errors
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create event. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50  z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* LCL 2.0: Enhanced bottom sheet with upward shadow */}
      <div className="bg-white rounded-t-[2rem] sm:rounded-3xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-up-sheet pb-safe">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-[2rem]">
          <h2 className="text-xl font-bold text-zinc-900">Create Event</h2>
          {/* LCL 2.0: Close button meets 44px touch target */}
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-2">
              Event Image
            </label>
            <div className="relative">
              {imagePreview ? (
                <div className="relative aspect-video rounded-xl overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (imagePreview) {
                        URL.revokeObjectURL(imagePreview);
                      }
                      setImageFile(null);
                      setImagePreview("");
                    }}
                    className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <label className="block aspect-video rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 cursor-pointer bg-gray-50 flex flex-col items-center justify-center transition-colors">
                  <Upload size={32} className="text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-600">
                    Upload Event Image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-2">
              Event Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none"
              placeholder="e.g., Sunday Cinema Night"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none resize-none"
              placeholder="Tell people what to expect..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-900 mb-2">
                <Calendar size={16} className="inline mr-1" />
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.event_date}
                onChange={(e) =>
                  setFormData({ ...formData, event_date: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-zinc-900 mb-2">
                <Clock size={16} className="inline mr-1" />
                Time *
              </label>
              <input
                type="time"
                required
                value={formData.event_time}
                onChange={(e) =>
                  setFormData({ ...formData, event_time: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-2">
              <MapPin size={16} className="inline mr-1" />
              Venue *
            </label>
            <input
              type="text"
              required
              value={formData.venue_name}
              onChange={(e) =>
                setFormData({ ...formData, venue_name: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none"
              placeholder="e.g., Central Cinema"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-2">
              Category *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  category: e.target.value as
                    | "cinema"
                    | "market"
                    | "crafts"
                    | "sports"
                    | "gaming",
                })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none"
            >
              <option value="cinema">Cinema</option>
              <option value="market">Market</option>
              <option value="crafts">Crafts</option>
              <option value="sports">Sports</option>
              <option value="gaming">Gaming</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-2">
              Max Attendees (0 = unlimited)
            </label>
            <input
              type="number"
              min="0"
              value={formData.max_attendees}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  max_attendees: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none"
            />
          </div>

          {/* Private Event Toggle */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock size={20} className="text-zinc-700" />
                <div>
                  <label className="block text-sm font-bold text-zinc-900">
                    Private Event
                  </label>
                  <p className="text-xs text-gray-500">
                    Only invited users can see and join
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPrivate(!isPrivate);
                  if (!isPrivate) {
                    setInvitedUserIds([]);
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPrivate ? "bg-zinc-900" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPrivate ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Invite Friends Section */}
            {isPrivate && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={18} className="text-zinc-700" />
                  <label className="block text-sm font-bold text-zinc-900">
                    Invite Friends
                  </label>
                </div>
                <UserPicker
                  selectedIds={invitedUserIds}
                  onChange={setInvitedUserIds}
                  placeholder="Search for friends to invite..."
                  multiple={true}
                />
                {invitedUserIds.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    Note: Private events require at least one invited user
                  </p>
                )}
              </div>
            )}
          </div>

          {/* LCL 2.0: Touch targets meet 52px for comfortable primary action */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 min-h-[52px] border border-gray-300 rounded-xl font-bold text-zinc-900 hover:bg-gray-50 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-4 min-h-[52px] bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
