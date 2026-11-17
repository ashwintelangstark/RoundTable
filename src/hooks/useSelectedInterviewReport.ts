import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";

export function useSelectedInterviewReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedInterviewId, setSelectedInterviewId] = useState<number | null>(null);

  const { data: interviewsData } = useQuery({
    queryKey: ["interviews"],
    queryFn: api.listInterviews,
  });

  const interviews = useMemo(() => interviewsData?.interviews ?? [], [interviewsData?.interviews]);
  const requestedId = Number(searchParams.get("interviewId"));

  useEffect(() => {
    if (requestedId && interviews.some((i) => i.id === requestedId)) {
      setSelectedInterviewId(requestedId);
    } else if (!selectedInterviewId && interviews.length > 0) {
      const latestCompleted = interviews.find((i) => i.status === "Completed");
      const fallback = latestCompleted ?? interviews[0];
      if (fallback) {
        setSelectedInterviewId(fallback.id);
      }
    }
  }, [requestedId, interviews, selectedInterviewId]);

  const { data: sessionData, isFetching } = useQuery({
    queryKey: ["interview-detail", selectedInterviewId],
    queryFn: () => api.getInterview(selectedInterviewId!),
    enabled: Boolean(selectedInterviewId),
  });

  function selectInterview(id: number) {
    setSelectedInterviewId(id || null);
    if (id) {
      setSearchParams({ interviewId: String(id) });
    } else {
      setSearchParams({});
    }
  }

  return {
    interviews,
    selectedInterviewId,
    selectInterview,
    sessionData: sessionData ?? null,
    loadingSession: isFetching,
  };
}
