import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SkillTagInput from '@/components/profile/SkillTagInput';
import TimezoneSelect from '@/components/profile/TimezoneSelect';
import AvailabilityToggle from '@/components/profile/AvailabilityToggle';

const TARGET_ROLE_OPTIONS = [
  'Frontend',
  'Backend',
  'Full Stack',
  'Mobile',
  'DevOps / Cloud',
  'Systems',
  'AI / ML',
];

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    bio: '',
    avatarUrl: '',
    targetRoles: [],
    skills: [],
    timeZone: 'UTC',
    availability: {
      isSearching: true,
      preferredWindows: ['Weekday Evenings', 'Weekends'],
    },
  });

  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Populate form with user profile on mount
  useEffect(() => {
    if (user?.profile) {
      setFormData({
        bio: user.profile.bio || '',
        avatarUrl: user.profile.avatarUrl || '',
        targetRoles: user.profile.targetRoles || [],
        skills: user.profile.skills || [],
        timeZone: user.profile.timeZone || 'UTC',
        availability: user.profile.availability || {
          isSearching: true,
          preferredWindows: ['Weekday Evenings', 'Weekends'],
        },
      });
      setAvatarLoadError(false);
    }
  }, [user]);

  const handleToggleRole = (role) => {
    setFormData((prev) => {
      const exists = prev.targetRoles.includes(role);
      return {
        ...prev,
        targetRoles: exists
          ? prev.targetRoles.filter((r) => r !== role)
          : [...prev.targetRoles, role],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await updateProfile(formData);
      if (res.success) {
        setSuccessMessage('Profile preferences saved successfully.');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(res.error || 'Failed to update profile');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'PF';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <DashboardLayout title="Developer Profile & Preferences">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Page Header */}
        <div className="pb-2 border-b border-neutral-900">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Developer Profile &amp; Preferences
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure your technical focus, target interview roles, and availability for peer matching
          </p>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/80 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/80 text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identity & Avatar Section */}
          <section className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-neutral-400" />
              <span>Identity &amp; Bio</span>
            </h2>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-lg bg-neutral-800 border border-neutral-700/80 flex items-center justify-center overflow-hidden shrink-0">
                {formData.avatarUrl && !avatarLoadError ? (
                  <img
                    src={formData.avatarUrl}
                    alt={user?.name || 'Developer Avatar'}
                    onError={() => setAvatarLoadError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-base font-semibold font-mono text-neutral-200">
                    {getInitials(user?.name)}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="block text-xs font-medium text-neutral-400">
                  Avatar Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.avatarUrl}
                  onChange={(e) => {
                    setFormData({ ...formData, avatarUrl: e.target.value });
                    setAvatarLoadError(false);
                  }}
                  placeholder="https://github.com/your-username.png"
                  className="w-full px-3 py-1.5 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 transition-colors"
                />
                <p className="text-[11px] text-neutral-400">
                  Supports GitHub or Gravatar image URLs. Default is your initials badge.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-neutral-800/60">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-400">
                  Short Bio
                </label>
                <span className="text-[11px] font-mono text-neutral-400 tabular-nums">
                  {formData.bio.length} / 300
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={300}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Software engineer interested in backend architecture and distributed systems..."
                className="w-full px-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 transition-colors resize-none"
              />
            </div>
          </section>

          {/* Target Roles */}
          <section className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white mb-0.5">
                Target Interview Roles
              </h2>
              <p className="text-[11px] text-neutral-400">
                Select the engineering tracks you want to practice for (multi-select)
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {TARGET_ROLE_OPTIONS.map((role) => {
                const isSelected = formData.targetRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleToggleRole(role)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer border ${
                      isSelected
                        ? 'bg-neutral-100 text-neutral-900 border-neutral-100 font-semibold'
                        : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Primary Skills */}
          <section className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white mb-0.5">
                Primary Tech Stack &amp; Skills
              </h2>
              <p className="text-[11px] text-neutral-400">
                Languages, frameworks, and topics you want to interview on or practice
              </p>
            </div>

            <SkillTagInput
              value={formData.skills}
              onChange={(nextSkills) => setFormData({ ...formData, skills: nextSkills })}
            />
          </section>

          {/* Availability & Timezone */}
          <section className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white mb-0.5">
                Availability &amp; Timezone
              </h2>
              <p className="text-[11px] text-neutral-400">
                Set when you are available for live peer interview matching
              </p>
            </div>

            <TimezoneSelect
              value={formData.timeZone}
              onChange={(tz) => setFormData({ ...formData, timeZone: tz })}
            />

            <div className="pt-2 border-t border-neutral-800/60">
              <AvailabilityToggle
                value={formData.availability}
                onChange={(avail) => setFormData({ ...formData, availability: avail })}
              />
            </div>
          </section>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-md text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-md bg-white hover:bg-neutral-200 text-neutral-900 font-medium text-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shadow-sm active:scale-[0.99]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
