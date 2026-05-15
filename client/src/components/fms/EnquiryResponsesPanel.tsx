import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { CalendarDays, Clock, MapPin, Loader2, User, Briefcase, DollarSign } from "lucide-react";

type ResponseValue = "yes" | "no" | "maybe" | null;

interface FreelancerResponse {
  response: {
    id: number;
    freelancerId: number;
    response: ResponseValue;
    responseNote: string | null;
    respondedAt: string | null;
    convertedToBookingId: number | null;
    convertedAt: string | null;
  };
  profile: {
    first_name: string | null;
    last_name: string | null;
    profile_image_url: string | null;
    title: string | null;
  } | null;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface EnquiryDetail {
  enquiry: {
    id: number;
    eventTitle: string;
    eventDate: string;
    callTime: string | null;
    venueAddress: string | null;
    roleRequired: string | null;
    agreedRate: string | null;
  };
  responses: FreelancerResponse[];
}

const RESPONSE_ORDER: Record<string, number> = { yes: 0, maybe: 1, null: 2, no: 3 };

function responseSortKey(r: FreelancerResponse) {
  return RESPONSE_ORDER[String(r.response.response)] ?? 2;
}

function ResponseBadge({ value }: { value: ResponseValue }) {
  if (value === "yes")
    return <Badge className="bg-green-500 text-white hover:bg-green-500">Yes</Badge>;
  if (value === "maybe")
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Maybe</Badge>;
  if (value === "no")
    return <Badge className="bg-red-500 text-white hover:bg-red-500">No</Badge>;
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Awaiting response
    </Badge>
  );
}

interface Props {
  enquiryId: number;
  onClose: () => void;
}

export function EnquiryResponsesPanel({ enquiryId, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<EnquiryDetail>({
    queryKey: ["/api/enquiries", enquiryId, "responses"],
    queryFn: () =>
      fetch(`/api/enquiries/${enquiryId}/responses`).then((r) => r.json()),
  });

  const convertMutation = useMutation({
    mutationFn: (responseId: number) =>
      apiRequest(`/api/enquiries/${enquiryId}/convert/${responseId}`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Booking confirmed", description: "The freelancer has been booked." });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    },
    onError: (err: any) => {
      toast({
        title: "Could not convert to booking",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-5 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { enquiry, responses } = data;
  const sorted = [...responses].sort((a, b) => responseSortKey(a) - responseSortKey(b));

  return (
    <div className="p-5 space-y-5">
      {/* Enquiry header */}
      <div className="space-y-1.5">
        <h4 className="font-semibold text-base">{enquiry.eventTitle}</h4>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {enquiry.eventDate}
          </span>
          {enquiry.callTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {enquiry.callTime}
            </span>
          )}
          {enquiry.venueAddress && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {enquiry.venueAddress}
            </span>
          )}
          {enquiry.roleRequired && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              {enquiry.roleRequired}
            </span>
          )}
          {enquiry.agreedRate && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {enquiry.agreedRate}
            </span>
          )}
        </div>
      </div>

      <div className="border-t" />

      {/* Response rows */}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No responses yet.</p>
      ) : (
        <div className="divide-y">
          {sorted.map(({ response: resp, profile, user }) => {
            const firstName = profile?.first_name ?? user.firstName;
            const lastName = profile?.last_name ?? user.lastName;
            const photo = profile?.profile_image_url ?? null;
            const title = profile?.title ?? null;

            return (
              <div key={resp.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                {/* Avatar + name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {photo ? (
                    <img
                      src={photo}
                      alt={`${firstName} ${lastName}`}
                      className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
                      <User className="h-5 w-5 text-orange-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {firstName} {lastName}
                    </p>
                    {title && (
                      <p className="text-xs text-muted-foreground truncate">{title}</p>
                    )}
                  </div>
                </div>

                {/* Badge + note + timestamp */}
                <div className="flex flex-col gap-1 sm:items-end">
                  <ResponseBadge value={resp.response} />
                  {resp.responseNote && (
                    <p className="text-xs italic text-muted-foreground max-w-xs text-right">
                      "{resp.responseNote}"
                    </p>
                  )}
                  {resp.respondedAt && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(resp.respondedAt), "d MMM, HH:mm")}
                    </p>
                  )}
                </div>

                {/* Book Now / Booked chip */}
                {resp.response === "yes" && (
                  <div className="sm:ml-2 flex-shrink-0">
                    {resp.convertedToBookingId ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        Booked
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={convertMutation.isPending}
                        onClick={() => convertMutation.mutate(resp.id)}
                        className="bg-orange-500 hover:bg-orange-600 h-8 text-xs"
                      >
                        {convertMutation.isPending && (
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        )}
                        Book Now
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
