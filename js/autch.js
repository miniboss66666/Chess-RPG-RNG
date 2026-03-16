const Auth = (() => {
  let currentUser = null;

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      return currentUser;
    }
    return null;
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    return currentUser;
  }

  async function register(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    currentUser = data.user;
    if (currentUser) {
      const username = email.split('@')[0];
      await supabase.from('profiles').upsert({
        id: currentUser.id,
        username,
        coin: 200
      });
    }
    return currentUser;
  }

  async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
  }

  async function getProfile() {
    if (!currentUser) return null;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();
    return data;
  }

  function getUser() { return currentUser; }

  return { init, login, register, logout, getProfile, getUser };
})();