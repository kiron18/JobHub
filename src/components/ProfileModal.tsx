import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, User, Briefcase, GraduationCap, Plus, Loader2, RotateCcw, RotateCw, Trophy, Check, FileText, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { toast } from 'sonner';

interface ResumeVersion {
  id: string;
  label: string;
  createdAt: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [isDeletingVersion, setIsDeletingVersion] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
      fetchResumeVersions();
    }
  }, [isOpen]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/profile');
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const fetchResumeVersions = async () => {
    try {
      const { data } = await api.get('/profile/resumes');
      setResumeVersions(data);
    } catch (error) {
      console.error('Failed to fetch resume versions:', error);
    }
  };

  const handleDeleteVersion = async (id: string, label: string) => {
    if (!window.confirm(`Delete the resume import "${label}"? This does not remove any achievements already added to your bank.`)) return;
    setIsDeletingVersion(id);
    try {
      await api.delete(`/profile/resumes/${id}`);
      setResumeVersions(prev => prev.filter(v => v.id !== id));
      toast.success('Resume import deleted');
    } catch (error) {
      console.error('Failed to delete resume version:', error);
      toast.error('Failed to delete resume import');
    } finally {
      setIsDeletingVersion(null);
    }
  };

  const updateProfile = (newProfile: any) => {
    setHistory(prev => [...prev, profile]);
    setRedoStack([]);
    setProfile(newProfile);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack(prev => [...prev, profile]);
    setHistory(prev => prev.slice(0, -1));
    setProfile(previous);
    toast.info("Undo successful");
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, profile]);
    setRedoStack(prev => prev.slice(0, -1));
    setProfile(next);
    toast.info("Redo successful");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profile, history, redoStack]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Server expects { profile: {...}, experience, education, ... } shape
      await api.post('/profile', {
        profile: {
          name: profile?.name,
          email: profile?.email,
          professionalSummary: profile?.professionalSummary,
          location: profile?.location,
          phone: profile?.phone,
          linkedin: profile?.linkedin,
        },
        experience: profile?.experience,
        education: profile?.education,
        volunteering: profile?.volunteering,
        certifications: profile?.certifications,
        languages: profile?.languages,
        skills: profile?.skills,
        coachingAlerts: profile?.coachingAlerts,
      });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success("Profile saved successfully");
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <User className="w-6 h-6 text-brand-400" />
                Profile Management
              </h2>
              <p className="text-white/40 text-sm">Review and refine your information bank</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 border-r border-white/10 pr-4 mr-2">
                <button 
                  onClick={undo}
                  disabled={history.length === 0}
                  className="p-2 text-white/40 hover:text-white transition-colors disabled:opacity-20"
                  title="Undo (Ctrl+Z)"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button 
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="p-2 text-white/40 hover:text-white transition-colors disabled:opacity-20"
                  title="Redo (Ctrl+Y)"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              </div>
              <button
                id="save-profile-btn"
                onClick={handleSave}
                disabled={isSaving || loading}
                className="flex items-center gap-2 px-6 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-600/20"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
                <p className="text-slate-400 font-medium animate-pulse">Loading profile...</p>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-8">
                  <ProfileIsland title="Personal Details" icon={<User className="w-5 h-5" />}>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs uppercase tracking-widest text-white/30 font-bold mb-2 block">Full Name</label>
                        <EditablePill 
                          value={profile?.name} 
                          onSave={(val) => updateProfile({ ...profile, name: val })} 
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-white/30 font-bold mb-2 block">Email</label>
                        <EditablePill 
                          value={profile?.email} 
                          onSave={(val) => updateProfile({ ...profile, email: val })} 
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-white/30 font-bold mb-2 block">Location</label>
                        <EditablePill 
                          value={profile?.location} 
                          label="Location"
                          onSave={(val) => updateProfile({ ...profile, location: val })} 
                        />
                      </div>
                    </div>
                  </ProfileIsland>

                  <ProfileIsland title="Professional Summary" icon={<Briefcase className="w-5 h-5" />}>
                    <div className="flex flex-wrap gap-3">
                      {(profile?.professionalSummary || '').split(/(?<=[.!?])\s+/).filter(Boolean).map((sentence: string, idx: number) => (
                        <EditablePill 
                          key={idx}
                          value={sentence} 
                          onSave={(newVal) => {
                            const sentences = (profile?.professionalSummary || '').split(/(?<=[.!?])\s+/).filter(Boolean);
                            sentences[idx] = newVal;
                            updateProfile({ ...profile, professionalSummary: sentences.join(' ') });
                          }} 
                        />
                      ))}
                      {!(profile?.professionalSummary) && (
                        <button 
                          onClick={() => updateProfile({ ...profile, professionalSummary: 'Experienced professional with a proven track record.' })}
                          className="px-4 py-2 rounded-full border border-brand-500/30 text-brand-400 text-sm hover:bg-brand-500/10 transition-colors flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add Summary
                        </button>
                      )}
                    </div>
                  </ProfileIsland>
                </div>

                <ProfileIsland title="Impact & Achievements" icon={<Trophy className="w-5 h-5" />}>
                  <div className="flex flex-wrap gap-3">
                    {profile?.achievements?.map((ach: any, idx: number) => (
                      <EditablePill 
                        key={idx}
                        value={`${ach.title}: ${ach.description}`}
                        onSave={(val) => {
                          const [title, ...descParts] = val.split(':');
                          const newAch = [...profile.achievements];
                          newAch[idx] = { ...ach, title: title.trim(), description: descParts.join(':').trim() };
                          updateProfile({ ...profile, achievements: newAch });
                        }}
                      />
                    ))}
                    <button 
                      onClick={() => updateProfile({ ...profile, achievements: [...(profile?.achievements || []), { title: 'New', description: 'Achievement' }]})}
                      className="px-4 py-2 rounded-full border border-brand-500/30 text-brand-400 text-sm hover:bg-brand-500/10 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add Achievement
                    </button>
                  </div>
                </ProfileIsland>

                <ProfileIsland title="Work Experience" icon={<Briefcase className="w-5 h-5" />}>
                  <div className="space-y-6">
                    {profile?.experience?.map((exp: any, idx: number) => (
                      <div key={idx} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] uppercase font-black text-white/30 tracking-widest">{exp.company}</label>
                          <div className="h-px flex-1 bg-white/5"></div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <EditablePill 
                            value={exp.role} 
                            label="Role"
                            onSave={(val) => {
                              const newExp = [...profile.experience];
                              newExp[idx] = { ...exp, role: val };
                              updateProfile({ ...profile, experience: newExp });
                            }} 
                          />
                          {(exp.description || '').split('\n').filter(Boolean).map((bullet: string, bIdx: number) => (
                            <EditablePill 
                              key={bIdx}
                              value={bullet}
                              onSave={(val) => {
                                const bullets = (exp.description || '').split('\n').filter(Boolean);
                                bullets[bIdx] = val;
                                const newExp = [...profile.experience];
                                newExp[idx] = { ...exp, description: bullets.join('\n') };
                                updateProfile({ ...profile, experience: newExp });
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => updateProfile({ ...profile, experience: [...(profile?.experience || []), { company: 'New Company', role: 'Role', description: 'Bullet point' }]})}
                      className="px-4 py-2 rounded-full border border-brand-500/30 text-brand-400 text-sm hover:bg-brand-500/10 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add Experience
                    </button>
                  </div>
                </ProfileIsland>

                <ProfileIsland title="Education" icon={<GraduationCap className="w-5 h-5" />}>
                  <div className="flex flex-wrap gap-3">
                    {profile?.education?.map((edu: any, idx: number) => (
                      <EditablePill
                        key={idx}
                        value={`${edu.degree} at ${edu.institution}`}
                        onSave={(val) => {
                          const [degree, ...instParts] = val.split(' at ');
                          const newEdu = [...profile.education];
                          newEdu[idx] = { ...edu, degree: degree.trim(), institution: instParts.join(' at ').trim() };
                          updateProfile({ ...profile, education: newEdu });
                        }}
                      />
                    ))}
                    <button
                      onClick={() => updateProfile({ ...profile, education: [...(profile?.education || []), { institution: 'University', degree: 'Degree' }]})}
                      className="px-4 py-2 rounded-full border border-brand-500/30 text-brand-400 text-sm hover:bg-brand-500/10 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add Education
                    </button>
                  </div>
                </ProfileIsland>

                {/* Resume History — read-only log of named resume imports */}
                <ProfileIsland title="Your resume imports" icon={<FileText className="w-5 h-5" />}>
                  <p className="text-xs text-white/30 mb-4">
                    Each resume you import expands your achievement bank. Your achievements are shared across all imports.
                  </p>
                  {resumeVersions.length === 0 ? (
                    <p className="text-sm text-white/20 italic">No resume imports recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {resumeVersions.map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white/80">{version.label}</p>
                            <p className="text-xs text-white/30">
                              {new Date(version.createdAt).toLocaleDateString('en-AU', {
                                day: 'numeric', month: 'short', year: 'numeric'
                              })}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteVersion(version.id, version.label)}
                            disabled={isDeletingVersion === version.id}
                            className="p-2 text-white/20 hover:text-red-400 transition-colors disabled:opacity-30"
                            title="Delete this import record"
                          >
                            {isDeletingVersion === version.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </ProfileIsland>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const ProfileIsland = ({ title, icon, children }: any) => (
  <section className="space-y-4">
    <div className="flex items-center gap-3 border-b border-white/5 pb-2">
      <div className="text-brand-400">{icon}</div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
    </div>
    {children}
  </section>
);

const EditablePill = ({ value, onSave, label }: { value: string, onSave: (val: string) => void, label?: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');

  useEffect(() => {
    setTempValue(value || '');
  }, [value]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 bg-white/10 border border-brand-500/50 px-3 py-1.5 rounded-full animate-in fade-in zoom-in-95 shadow-inner">
        <input
          autoFocus
          className="bg-transparent text-sm text-white outline-none w-auto min-w-[120px]"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onSave(tempValue); setIsEditing(false); }
            if (e.key === 'Escape') { setTempValue(value); setIsEditing(false); }
          }}
          onBlur={() => { onSave(tempValue); setIsEditing(false); }}
        />
        <button onClick={() => { onSave(tempValue); setIsEditing(false); }} className="text-emerald-400 hover:text-emerald-300">
          <Check size={14} />
        </button>
      </div>
    );
  }

  return (
    <div 
      onClick={() => setIsEditing(true)}
      className="group relative cursor-pointer px-4 py-1.5 bg-white/5 hover:bg-brand-500/10 border border-white/10 hover:border-brand-500/40 rounded-full transition-all flex items-center gap-2"
    >
      {label && <span className="text-[10px] font-black text-brand-500/60 uppercase tracking-widest leading-none">{label}</span>}
      <span className={`text-sm font-medium ${!value ? 'text-white/30 italic' : 'text-white/80'}`}>
        {value || (label?.toLowerCase() === 'location' ? 'Not specified' : 'Click to add')}
      </span>
    </div>
  );
};
