// ===== SUPABASE CONFIG =====
const SUPABASE_URL = "https://oggwnbbfuaemkrpxvctd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nZ3duYmJmdWFlbWtycHh2Y3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDMzNjcsImV4cCI6MjA5MjExOTM2N30.p1lKczMqndxcvpqgqI_DcB3SEeWP1n-FmX8xh_BWZrE";

// Load Supabase
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js";
document.head.appendChild(script);

let supabase;

script.onload = () => {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
};

// ===== SIMPLE LOGIN =====
async function loginUser(email) {
  let { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (!data) {
    let res = await supabase.from("users").insert([{ email: email }]).select().single();
    data = res.data;
  }

  localStorage.setItem("user", JSON.stringify(data));
  return data;
}

// ===== SAVE REPORT =====
async function saveReport(reportData) {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return;

  await supabase.from("reports").insert([{
    user_id: user.id,
    idea: reportData.idea,
    location: reportData.location,
    budget: reportData.budget,
    timeline: reportData.timeline,
    result: reportData.result
  }]);
}

// ===== MODIFY YOUR ANALYZE BUTTON =====
async function analyzeIdea() {
  const idea = document.querySelector("textarea").value;
  const location = document.querySelectorAll("input")[0].value;
  const budget = document.querySelectorAll("input")[1].value;
  const timeline = document.querySelectorAll("input")[2].value;

  // LOGIN (simple)
  let email = prompt("Enter your email:");
  const user = await loginUser(email);

  // FAKE RESULT (replace later with AI if needed)
  let result = `
  Business Idea: ${idea}
  Market: Growing demand
  ROI: High potential
  `;

  // SAVE TO DATABASE
  await saveReport({
    idea,
    location,
    budget,
    timeline,
    result
  });

  alert("Analysis saved to your account!");
}