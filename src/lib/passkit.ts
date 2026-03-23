import { supabase } from "@/integrations/supabase/client";

export interface PassKitMember {
  id?: string;
  externalId?: string;
  person?: {
    forename?: string;
    surname?: string;
    emailAddress?: string;
    mobileNumber?: string;
  };
  points?: {
    currentPoints?: number;
  };
  found?: boolean;
}

async function callPassKit(action: string, params: Record<string, any>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("passkit-loyalty", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "PassKit request failed");
  return data;
}

export async function enrolMember(params: {
  programId: string;
  tierId: string;
  externalId?: string;
  name: string;
  email?: string;
  phone?: string;
  points?: number;
}): Promise<PassKitMember> {
  return callPassKit("enrol", params);
}

export async function getMember(programId: string, externalId: string): Promise<PassKitMember> {
  return callPassKit("getMember", { programId, externalId });
}

export async function earnPoints(params: {
  memberId?: string;
  externalId?: string;
  programId?: string;
  points: number;
}): Promise<any> {
  return callPassKit("earnPoints", params);
}

export async function burnPoints(params: {
  memberId?: string;
  externalId?: string;
  programId?: string;
  points: number;
}): Promise<any> {
  return callPassKit("burnPoints", params);
}

export async function listMembers(programId: string, limit = 50, skip = 0): Promise<any> {
  return callPassKit("listMembers", { programId, limit, skip });
}

export async function checkInMember(params: {
  memberId?: string;
  externalId?: string;
  programId?: string;
}): Promise<any> {
  return callPassKit("checkIn", params);
}
