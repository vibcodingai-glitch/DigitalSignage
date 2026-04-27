const axios = require('axios');

async function test() {
  console.log("Starting test flow...");
  let token;
  try {
    const res = await axios.post("http://localhost:5000/api/auth/login", {
      email: "admin@signagehub.com",
      password: "password123"
    });
    token = res.data.data.accessToken;
    console.log("Logged in!");
  } catch (e) {
    console.log("Login failed", e.message);
    return;
  }

  const api = axios.create({
    baseURL: "http://localhost:5000/api",
    headers: { Authorization: `Bearer ${token}` }
  });

  let project;
  try {
    const res = await api.post("/projects", {
      name: "Test Project " + Date.now(),
      layoutType: "FULLSCREEN"
    });
    project = res.data.data;
    console.log("Created project:", project.id);
  } catch (e) {
    console.log("Create project failed", e.response?.data || e.message);
    return;
  }

  let linkItem;
  try {
    const res = await api.post("/content/link", {
      name: "Test Link",
      type: "URL",
      sourceUrl: "https://example.com",
      durationSeconds: 15
    });
    linkItem = res.data.data;
    console.log("Created link item:", linkItem.id);
  } catch (e) {
    console.log("Create link failed", e.response?.data || e.message);
  }

  if (linkItem) {
    try {
      const res = await api.post(`/playlists/${project.id}/items`, {
        contentItemId: linkItem.id,
        zoneIndex: 0,
        orderIndex: 0,
        durationOverride: 15
      });
      console.log("Added to playlist:", res.data.data.id);
    } catch (e) {
      console.log("Add to playlist failed", e.response?.data || e.message);
    }
  }

  let screen;
  try {
    const res = await api.get("/screens");
    if (res.data.data.length > 0) {
      screen = res.data.data[0];
      console.log("Found screen:", screen.id);
    }
  } catch (e) {
    console.log("Get screens failed", e.response?.data || e.message);
  }

  if (screen) {
    try {
      const res = await api.post(`/screens/${screen.id}/projects`, {
        projectId: project.id,
        scheduleType: "ALWAYS",
        priority: 0,
        daysOfWeek: [0,1,2,3,4,5,6],
        startTime: "00:00",
        endTime: "23:59"
      });
      console.log("Assigned to screen:", res.data.data.id);
    } catch (e) {
      console.log("Assign to screen failed", e.response?.data || e.message);
    }
  }
}

test();
