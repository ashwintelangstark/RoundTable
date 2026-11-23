import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Play, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthContext";
import { ModalDialog } from "@/components/ModalDialog";
import { useToast } from "@/components/ToastContext";
import { api, type InterviewSession } from "@/lib/api";

const ROUND_TYPES = ["Technical Round", "HR Round"] as const;
const APPROACHES = ["Standard Panel", "Technical Heavy", "Behavioral Heavy", "Stress Simulation"];
const DURATIONS = [10, 15, 20];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const EXPERIENCES = ["Entry level", "1–3 years", "3–5 years", "5+ years"];

export function RegistrationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { user } = useAuth();
  const formHeadingId = useId();

  const [candidateName, setCandidateName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [companyDesc, setCompanyDesc] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [duration, setDuration] = useState("15");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [roundType, setRoundType] = useState<string>("Technical Round");
  const [approach, setApproach] = useState("Standard Panel");
  const [experienceLevel, setExperienceLevel] = useState("1–3 years");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [ariaInvalidMap, setAriaInvalidMap] = useState<Record<string, boolean>>({});

  // Edit / Repeat / Delete modal state
  const [editing, setEditing] = useState<InterviewSession | null>(null);
  const [editResume, setEditResume] = useState<File | null>(null);
  const [repeating, setRepeating] = useState<InterviewSession | null>(null);
  const [repeatRoundType, setRepeatRoundType] = useState("Technical Round");
  const [repeatApproach, setRepeatApproach] = useState("Technical Heavy");
  const [repeatDuration, setRepeatDuration] = useState("15");
  const [deleting, setDeleting] = useState<InterviewSession | null>(null);

  const { data } = useQuery({
    queryKey: ["interviews"],
    queryFn: api.listInterviews,
  });

  const createMutation = useMutation({
    mutationFn: (fd: FormData) => api.createInterview(fd),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      notify(`Registered ${res.interview.role} at ${res.interview.company_name}.`);
      setCompanyName("");
      setRole("");
      setCompanyDesc("");
      setJobDescription("");
      setResumeFile(null);
      setAriaInvalidMap({});
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Failed to save", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fd }: { id: number; fd: FormData }) => api.updateInterview(id, fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
      setEditResume(null);
      notify("Interview registration updated.");
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Update failed", "error"),
  });

  const repeatMutation = useMutation({
    mutationFn: ({
      id,
      payload,
      enterRoom,
    }: {
      id: number;
      payload: { approach: string; duration_minutes: number; round_type: string };
      enterRoom: boolean;
    }) => api.repeatInterview(id, payload).then((r) => ({ ...r, enterRoom })),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setRepeating(null);
      notify(
        `Created repeat session (${res.interview.round_type ?? "Technical Round"} · ${res.interview.approach}).`,
      );
      if (res.enterRoom) {
        navigate(`/room?session=${res.interview.id}`);
      }
    },
    onError: (err) => notify(err instanceof Error ? err.message : "Repeat failed", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteInterview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["interview"] });
      queryClient.invalidateQueries({ queryKey: ["interview-detail"] });
      queryClient.invalidateQueries({ queryKey: ["agent-report"] });
      queryClient.invalidateQueries({ queryKey: ["career-history"] });
      queryClient.invalidateQueries({ queryKey: ["resume-history"] });
      setDeleting(null);
      notify("Interview session and all associated files permanently deleted.");
    },
  });

  function syncFieldValidity(el: HTMLInputElement | HTMLTextAreaElement) {
    const invalid = el.matches(":user-invalid");
    setAriaInvalidMap((prev) => ({ ...prev, [el.id]: invalid }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector(":invalid") as HTMLElement | null;
      firstInvalid?.focus();
      form.querySelectorAll("input, textarea").forEach((el) => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          setAriaInvalidMap((prev) => ({ ...prev, [el.id]: !el.validity.valid }));
        }
      });
      return;
    }

    const fd = new FormData();
    fd.append("candidate_name", candidateName.trim());
    fd.append("email", email.trim());
    fd.append("company_name", companyName.trim());
    fd.append("role", role.trim());
    fd.append("company_desc", companyDesc.trim());
    fd.append("job_description", jobDescription.trim());
    fd.append("duration_minutes", duration);
    fd.append("difficulty", difficulty);
    fd.append("round_type", roundType);
    fd.append("approach", approach);
    fd.append("experience_level", experienceLevel);
    if (resumeFile) fd.append("resume", resumeFile);

    createMutation.mutate(fd);
  }

  function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData();
    fd.append("candidate_name", editing.candidate_name);
    fd.append("email", editing.email);
    fd.append("company_name", editing.company_name);
    fd.append("role", editing.role);
    fd.append("company_desc", editing.company_desc);
    fd.append("job_description", editing.job_description);
    fd.append("duration_minutes", String(editing.duration_minutes));
    fd.append("difficulty", editing.difficulty);
    fd.append("round_type", editing.round_type ?? "Technical Round");
    fd.append("approach", editing.approach);
    fd.append("experience_level", editing.experience_level);
    if (editResume) fd.append("resume", editResume);

    updateMutation.mutate({ id: editing.id, fd });
  }

  const interviews = data?.interviews ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-5 items-start">
      <section className="rt-card">
        <h3 id={formHeadingId}>Register an interview</h3>
        <p className="text-xs text-[#697466] mb-4">
          Set the role context and attach your resume. All five RoundTable agents prepare around
          these details and persist them in your saved records.
        </p>

        <form aria-labelledby={formHeadingId} onSubmit={handleSubmit} noValidate>
          <div className="rt-field mb-4">
            <label htmlFor="reg-round-type">Interview round *</label>
            <div
              className="grid grid-cols-2 gap-2.5 mt-1"
              role="radiogroup"
              aria-label="Interview round"
            >
              {ROUND_TYPES.map((rt) => {
                const active = roundType === rt;
                return (
                  <button
                    key={rt}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setRoundType(rt);
                      setApproach(rt === "HR Round" ? "Behavioral Heavy" : "Technical Heavy");
                    }}
                    className={`rounded-xl p-3 text-left border transition-all ${
                      active
                        ? "bg-[#233a24] text-white border-[#233a24] shadow-sm"
                        : "bg-white/60 text-[#263328] border-[#d7dfd0] hover:bg-white/90"
                    }`}
                  >
                    <div className="text-xs font-semibold">{rt}</div>
                    <div
                      className={`text-[10px] mt-0.5 ${active ? "text-[#cfe2cc]" : "text-[#697466]"}`}
                    >
                      {rt === "Technical Round"
                        ? "Systems design, technical resume depth & engineering trade-offs"
                        : "Motivation, STAR leadership stories, culture & execution fit"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <div className="rt-field">
              <label htmlFor="reg-candidate">Candidate name *</label>
              <input
                id="reg-candidate"
                name="candidate_name"
                type="text"
                autoComplete="name"
                required
                className="rt-control"
                data-error="err-candidate"
                aria-invalid={ariaInvalidMap["reg-candidate"] ? "true" : "false"}
                aria-describedby={ariaInvalidMap["reg-candidate"] ? "err-candidate" : undefined}
                value={candidateName}
                onChange={(e) => {
                  setCandidateName(e.target.value);
                  if (ariaInvalidMap["reg-candidate"]) syncFieldValidity(e.target);
                }}
                onBlur={(e) => syncFieldValidity(e.target)}
                placeholder="Ashwin Telang"
              />
              <span id="err-candidate" className="rt-error-msg">
                Please enter your full name.
              </span>
            </div>

            <div className="rt-field">
              <label htmlFor="reg-email">Email *</label>
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                className="rt-control"
                aria-invalid={ariaInvalidMap["reg-email"] ? "true" : "false"}
                aria-describedby={ariaInvalidMap["reg-email"] ? "err-email" : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (ariaInvalidMap["reg-email"]) syncFieldValidity(e.target);
                }}
                onBlur={(e) => syncFieldValidity(e.target)}
                placeholder="you@example.com"
              />
              <span id="err-email" className="rt-error-msg">
                Enter an email address in the format you@example.com.
              </span>
            </div>

            <div className="rt-field">
              <label htmlFor="reg-company">Company name *</label>
              <input
                id="reg-company"
                name="company_name"
                type="text"
                required
                className="rt-control"
                aria-invalid={ariaInvalidMap["reg-company"] ? "true" : "false"}
                aria-describedby={ariaInvalidMap["reg-company"] ? "err-company" : undefined}
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (ariaInvalidMap["reg-company"]) syncFieldValidity(e.target);
                }}
                onBlur={(e) => syncFieldValidity(e.target)}
                placeholder="e.g. NVIDIA, Stripe, Anthropic"
              />
              <span id="err-company" className="rt-error-msg">
                Enter the target company name.
              </span>
            </div>

            <div className="rt-field">
              <label htmlFor="reg-role">Role applying for *</label>
              <input
                id="reg-role"
                name="role"
                type="text"
                required
                className="rt-control"
                aria-invalid={ariaInvalidMap["reg-role"] ? "true" : "false"}
                aria-describedby={ariaInvalidMap["reg-role"] ? "err-role" : undefined}
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  if (ariaInvalidMap["reg-role"]) syncFieldValidity(e.target);
                }}
                onBlur={(e) => syncFieldValidity(e.target)}
                placeholder="e.g. AI Engineer"
              />
              <span id="err-role" className="rt-error-msg">
                Enter the role title you are applying for.
              </span>
            </div>
          </div>

          <div className="rt-field">
            <label htmlFor="reg-company-desc">About the company / context</label>
            <textarea
              id="reg-company-desc"
              name="company_desc"
              className="rt-control"
              value={companyDesc}
              onChange={(e) => setCompanyDesc(e.target.value)}
              placeholder="What does the company build? Stage, engineering culture, or key products…"
            />
          </div>

          <div className="rt-field">
            <label htmlFor="reg-jd">Job description</label>
            <textarea
              id="reg-jd"
              name="job_description"
              className="rt-control"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description or required competencies…"
            />
          </div>

          <div
            className={`rt-upload mb-4 ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) setResumeFile(file);
            }}
          >
            <UploadCloud size={22} className="mx-auto text-[#526e50] mb-1" aria-hidden="true" />
            <label
              htmlFor="reg-resume"
              className="cursor-pointer font-semibold text-xs text-[#526e50] block"
            >
              Drop your resume here or browse files
            </label>
            <input
              id="reg-resume"
              name="resume"
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md"
              className="visually-hidden"
              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-[#697466] m-0 mt-1">
              {resumeFile ? `Selected: ${resumeFile.name}` : "PDF, DOCX, or TXT · Max 10 MB"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <div className="rt-field">
              <label htmlFor="reg-duration">Interview duration</label>
              <select
                id="reg-duration"
                name="duration_minutes"
                className="rt-control"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={String(d)}>
                    {d} minutes
                  </option>
                ))}
              </select>
            </div>

            <div className="rt-field">
              <label htmlFor="reg-difficulty">Difficulty</label>
              <select
                id="reg-difficulty"
                name="difficulty"
                className="rt-control"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="rt-field">
              <label htmlFor="reg-approach">Interview approach</label>
              <select
                id="reg-approach"
                name="approach"
                className="rt-control"
                value={approach}
                onChange={(e) => setApproach(e.target.value)}
              >
                {APPROACHES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="rt-field">
              <label htmlFor="reg-exp">Experience level</label>
              <select
                id="reg-exp"
                name="experience_level"
                className="rt-control"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
              >
                {EXPERIENCES.map((exp) => (
                  <option key={exp} value={exp}>
                    {exp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 mt-2">
            <button type="submit" className="rt-btn" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save interview registration →"}
            </button>
            <button
              type="reset"
              className="rt-btn secondary"
              onClick={() => {
                setCandidateName("");
                setEmail("");
                setCompanyName("");
                setRole("");
                setCompanyDesc("");
                setJobDescription("");
                setResumeFile(null);
                setAriaInvalidMap({});
              }}
            >
              Reset form
            </button>
          </div>
        </form>
      </section>

      <section className="rt-card">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="m-0">My interviews</h3>
          <span className="rt-tag">{interviews.length} sessions</span>
        </div>
        <p className="text-xs text-[#697466] mb-3">
          Enter the 3D room, edit details, delete, or repeat an earlier interview using a new panel
          approach.
        </p>

        <div className="divide-y divide-[#edf0e6]">
          {interviews.length === 0 ? (
            <p className="text-xs text-[#697466] py-6 text-center">
              No saved interviews yet. Register your first session on the left.
            </p>
          ) : (
            interviews.map((session) => (
              <div key={session.id} className="py-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-[#263328]">{session.role}</div>
                    <div className="text-xs text-[#697466]">
                      {session.company_name} · {session.round_type ?? "Technical Round"} ·{" "}
                      {session.duration_minutes} min
                    </div>
                    {session.resume_filename && (
                      <div className="text-[11px] text-[#526e50] mt-0.5">
                        Resume: {session.resume_filename}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="rt-tag">{session.status}</span>
                    {session.overall_score !== null && (
                      <div className="text-[11px] font-semibold text-[#526e50] mt-1">
                        Score: {session.overall_score}/100
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="rt-btn small"
                    onClick={() => navigate(`/room?session=${session.id}`)}
                  >
                    <Play size={12} aria-hidden="true" />
                    Enter room
                  </button>
                  <button
                    type="button"
                    className="rt-btn secondary small"
                    aria-label={`Edit ${session.role} at ${session.company_name}`}
                    onClick={() => setEditing({ ...session })}
                  >
                    <Edit3 size={12} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rt-btn secondary small"
                    aria-label={`Repeat ${session.role} at ${session.company_name} with different approach`}
                    onClick={() => {
                      setRepeating(session);
                      setRepeatRoundType(
                        session.round_type === "HR Round" ? "Technical Round" : "HR Round",
                      );
                      setRepeatApproach(
                        APPROACHES.find((a) => a !== session.approach) ?? "Technical Heavy",
                      );
                      setRepeatDuration(String(session.duration_minutes));
                    }}
                  >
                    <RefreshCw size={12} aria-hidden="true" />
                    Repeat
                  </button>
                  {session.status === "Completed" && (
                    <button
                      type="button"
                      className="rt-btn ghost small"
                      onClick={() => navigate(`/readiness?interviewId=${session.id}`)}
                    >
                      Report
                    </button>
                  )}
                  <button
                    type="button"
                    className="rt-btn ghost small text-[#b45349]"
                    aria-label={`Delete ${session.role} at ${session.company_name}`}
                    onClick={() => setDeleting(session)}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Edit Registration Dialog */}
      <ModalDialog
        open={Boolean(editing)}
        title="Edit interview registration"
        subtitle="Update target company, role context, or replace the resume."
        onClose={() => {
          setEditing(null);
          setEditResume(null);
        }}
      >
        {editing && (
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rt-field mb-0">
                <label htmlFor="edit-name">Candidate name</label>
                <input
                  id="edit-name"
                  className="rt-control"
                  required
                  autoFocus
                  value={editing.candidate_name}
                  onChange={(e) => setEditing({ ...editing, candidate_name: e.target.value })}
                />
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  className="rt-control"
                  required
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="edit-company">Company name</label>
                <input
                  id="edit-company"
                  className="rt-control"
                  required
                  value={editing.company_name}
                  onChange={(e) => setEditing({ ...editing, company_name: e.target.value })}
                />
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="edit-role">Role</label>
                <input
                  id="edit-role"
                  className="rt-control"
                  required
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                />
              </div>
            </div>
            <div className="rt-field mb-0">
              <label htmlFor="edit-desc">About company</label>
              <textarea
                id="edit-desc"
                className="rt-control"
                value={editing.company_desc}
                onChange={(e) => setEditing({ ...editing, company_desc: e.target.value })}
              />
            </div>
            <div className="rt-field mb-0">
              <label htmlFor="edit-jd">Job description</label>
              <textarea
                id="edit-jd"
                className="rt-control"
                value={editing.job_description}
                onChange={(e) => setEditing({ ...editing, job_description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rt-field mb-0">
                <label htmlFor="edit-round">Round</label>
                <select
                  id="edit-round"
                  className="rt-control"
                  value={editing.round_type ?? "Technical Round"}
                  onChange={(e) => setEditing({ ...editing, round_type: e.target.value })}
                >
                  {ROUND_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="edit-dur">Duration</label>
                <select
                  id="edit-dur"
                  className="rt-control"
                  value={String(editing.duration_minutes)}
                  onChange={(e) =>
                    setEditing({ ...editing, duration_minutes: Number(e.target.value) })
                  }
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={String(d)}>
                      {d} min
                    </option>
                  ))}
                </select>
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="edit-diff">Difficulty</label>
                <select
                  id="edit-diff"
                  className="rt-control"
                  value={editing.difficulty}
                  onChange={(e) => setEditing({ ...editing, difficulty: e.target.value })}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rt-field mb-0">
                <label htmlFor="edit-app">Approach</label>
                <select
                  id="edit-app"
                  className="rt-control"
                  value={editing.approach}
                  onChange={(e) => setEditing({ ...editing, approach: e.target.value })}
                >
                  {APPROACHES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rt-field mb-0">
              <label htmlFor="edit-resume">Replace resume (optional)</label>
              <input
                id="edit-resume"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                className="rt-control"
                onChange={(e) => setEditResume(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="rt-btn secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="rt-btn" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* Repeat Session Dialog */}
      <ModalDialog
        open={Boolean(repeating)}
        title="Repeat interview in a new approach"
        subtitle={
          repeating
            ? `Clone "${repeating.role} at ${repeating.company_name}" with a fresh panel emphasis.`
            : undefined
        }
        onClose={() => setRepeating(null)}
        maxWidth="480px"
      >
        {repeating && (
          <div className="space-y-4">
            <div className="rt-field mb-0">
              <label htmlFor="repeat-round-type">Select interview round</label>
              <select
                id="repeat-round-type"
                className="rt-control"
                autoFocus
                value={repeatRoundType}
                onChange={(e) => setRepeatRoundType(e.target.value)}
              >
                {ROUND_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
            </div>
            <div className="rt-field mb-0">
              <label htmlFor="repeat-approach">Select new interview approach</label>
              <select
                id="repeat-approach"
                className="rt-control"
                value={repeatApproach}
                onChange={(e) => setRepeatApproach(e.target.value)}
              >
                {APPROACHES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="rt-field mb-0">
              <label htmlFor="repeat-duration">Duration</label>
              <select
                id="repeat-duration"
                className="rt-control"
                value={repeatDuration}
                onChange={(e) => setRepeatDuration(e.target.value)}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={String(d)}>
                    {d} minutes
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button type="button" className="rt-btn secondary" onClick={() => setRepeating(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rt-btn secondary"
                onClick={() =>
                  repeatMutation.mutate({
                    id: repeating.id,
                    payload: {
                      round_type: repeatRoundType,
                      approach: repeatApproach,
                      duration_minutes: Number(repeatDuration),
                    },
                    enterRoom: false,
                  })
                }
              >
                Save to list
              </button>
              <button
                type="button"
                className="rt-btn"
                onClick={() =>
                  repeatMutation.mutate({
                    id: repeating.id,
                    payload: {
                      round_type: repeatRoundType,
                      approach: repeatApproach,
                      duration_minutes: Number(repeatDuration),
                    },
                    enterRoom: true,
                  })
                }
              >
                Clone & enter 3D room →
              </button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Delete Confirmation Dialog */}
      <ModalDialog
        open={Boolean(deleting)}
        title="Delete interview registration?"
        subtitle={
          deleting
            ? `This permanently deletes "${deleting.role} at ${deleting.company_name}" and its interview records.`
            : undefined
        }
        onClose={() => setDeleting(null)}
        maxWidth="440px"
      >
        {deleting && (
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rt-btn secondary"
              autoFocus
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rt-btn danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete session"}
            </button>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
