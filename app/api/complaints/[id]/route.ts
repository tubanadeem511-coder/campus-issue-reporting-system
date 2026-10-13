import { jsonError } from "@/lib/supabase";
import { authenticatedUser } from "@/lib/supabase-server";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await authenticatedUser(request);if(!auth.ok)return jsonError(auth.error,auth.status);
 const{id}=await params;const{data:complaint,error}=await auth.client.from("complaints").select("id,reference_number,title,category,building,room,description,image_path,status,created_at,updated_at,owner_id").eq("id",id).single();
 if(error||!complaint)return jsonError("Complaint not found or you do not have permission to view it.",404);
 const[{data:history},{data:image}]=await Promise.all([auth.client.from("complaint_status_history").select("old_status,new_status,changed_at,changed_by").eq("complaint_id",id).order("changed_at",{ascending:false}),complaint.image_path?auth.client.storage.from("complaint-images").createSignedUrl(complaint.image_path,300):Promise.resolve({data:null})]);
 return Response.json({complaint:{...complaint,image_url:image?.signedUrl??null},history:history??[]},{headers:{"Cache-Control":"no-store"}});
}
