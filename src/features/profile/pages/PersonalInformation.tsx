import { useState } from 'react';
import { ChevronLeft, User, Mail, MapPin, Calendar, Phone, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/features/auth';

export function PersonalInformation() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [formData, setFormData] = useState({
    fullName: profile?.full_name || '',
    email: profile?.user_id || '',
    phone: '',
    city: profile?.location_city || '',
    country: profile?.location_country || '',
    dateOfBirth: '',
    bio: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    
    // TODO: Implement actual save operation with backend API
    // This is a placeholder for demo purposes
    // In production, this should call the Supabase API to update the profile
    setTimeout(() => {
      toast.success('Personal information updated successfully');
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95  border-b border-border">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <User size={20} className="text-primary" />
            <h1 className="font-display text-xl text-foreground tracking-tight">
              Personal Information
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Basic Information */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-4 space-y-4"
        >
          <h2 className="font-semibold text-foreground mb-4">Basic Information</h2>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <div className="flex items-center gap-2">
                <User size={16} />
                Full Name
              </div>
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <div className="flex items-center gap-2">
                <Mail size={16} />
                Email Address
              </div>
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-muted-foreground"
              placeholder="your.email@example.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Email cannot be changed. Contact support if you need to update it.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <div className="flex items-center gap-2">
                <Phone size={16} />
                Phone Number (Optional)
              </div>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="+31 6 12345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                Date of Birth
              </div>
            </label>
            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used to verify age for events and improve recommendations
            </p>
          </div>
        </motion.section>

        {/* Location Information */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-4 space-y-4"
        >
          <h2 className="font-semibold text-foreground mb-4">
            <div className="flex items-center gap-2">
              <MapPin size={18} />
              Location
            </div>
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Meppel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Country
            </label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Netherlands"
            />
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              Your location helps us show you relevant local events and connect you with your community
            </p>
          </div>
        </motion.section>

        {/* Bio */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl p-4 space-y-4"
        >
          <h2 className="font-semibold text-foreground mb-4">About You</h2>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Tell others about yourself, your interests, and what you're looking for in the community..."
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {formData.bio.length}/500 characters
            </p>
          </div>
        </motion.section>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground rounded-full font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save size={18} />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </motion.div>

        {/* Data Notice */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-muted/50 rounded-lg p-4"
        >
          <p className="text-xs text-muted-foreground">
            <strong>Privacy Notice:</strong> Your personal information is protected under GDPR. 
            We only use this data to provide our services and will never sell it to third parties. 
            You can request deletion at any time from Privacy Settings.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default PersonalInformation;
