const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("🚀 Starting Quick Test...");

  // 1. Get Org
  const { data: orgs, error: orgError } = await supabase.from('organizations').select('id').limit(1);
  if (orgError || !orgs.length) {
    console.error("Failed to fetch organization", orgError);
    return;
  }
  const orgId = orgs[0].id;
  console.log("✅ Using Org ID:", orgId);

  // 2. Create Project
  const { data: project, error: projError } = await supabase.from('projects').insert({
    name: "Automated Test Project " + new Date().toISOString(),
    organization_id: orgId,
    layout_type: "fullscreen",
    is_active: true
  }).select().single();

  if (projError) {
    console.error("❌ Failed to create project", projError);
    return;
  }
  console.log("✅ Created Project ID:", project.id);

  // 3. Create Content Item (Link)
  const { data: content, error: contentError } = await supabase.from('content_items').insert({
    organization_id: orgId,
    name: "Test Link (Google)",
    type: "url",
    source_url: "https://www.google.com",
    duration_seconds: 10
  }).select().single();

  if (contentError) {
    console.error("❌ Failed to create content item", contentError);
    return;
  }
  console.log("✅ Created Content Item ID:", content.id);

  // 4. Add to Playlist
  const { data: playlistItem, error: plError } = await supabase.from('playlist_items').insert({
    project_id: project.id,
    content_item_id: content.id,
    order_index: 0,
    duration_override: 15
  }).select().single();

  if (plError) {
    console.error("❌ Failed to add to playlist", plError);
    return;
  }
  console.log("✅ Added to Playlist Item ID:", playlistItem.id);

  // 5. Get Screen
  const { data: screens, error: screenError } = await supabase.from('screens').select('id, name').limit(1);
  if (screenError || !screens.length) {
    console.error("Failed to fetch screens", screenError);
    return;
  }
  const screen = screens[0];
  console.log("✅ Using Screen:", screen.name, "(" + screen.id + ")");

  // 6. Assign to Screen
  const { data: assignment, error: assignError } = await supabase.from('screen_projects').insert({
    screen_id: screen.id,
    project_id: project.id,
    organization_id: orgId,
    schedule_type: "always",
    priority: 10,
    is_active: true
  }).select().single();

  if (assignError) {
    console.error("❌ Failed to assign project to screen", assignError);
    return;
  }
  console.log("✅ Assigned to Screen! Assignment ID:", assignment.id);

  console.log("\n✨ TEST SUCCESSFUL ✨");
}

runTest();
