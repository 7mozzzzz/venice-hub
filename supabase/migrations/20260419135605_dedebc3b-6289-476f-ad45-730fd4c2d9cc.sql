
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.post_category AS ENUM ('scripts', 'discussions', 'servers', 'help');
CREATE TYPE public.badge_type AS ENUM ('badge', 'rank');

-- =====================================================
-- UTILITY: updated_at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- USER ROLES (separate table — never on profiles!)
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =====================================================
-- BANNED USERS
-- =====================================================
CREATE TABLE public.banned_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_banned(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.banned_users WHERE user_id = _user_id)
$$;

-- =====================================================
-- POSTS
-- =====================================================
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category post_category NOT NULL,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_posts_category ON public.posts(category);
CREATE INDEX idx_posts_author ON public.posts(author_id);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);

CREATE TRIGGER trg_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comments_post ON public.comments(post_id);

-- =====================================================
-- LIKES
-- =====================================================
CREATE TABLE public.likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- BADGES
-- =====================================================
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'star',
  color TEXT NOT NULL DEFAULT '#a855f7',
  price_cents INTEGER NOT NULL DEFAULT 0,
  type badge_type NOT NULL DEFAULT 'badge',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- AUTO-CREATE PROFILE + DEFAULT ROLE ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
  IF length(base_username) < 3 THEN
    base_username := 'user' || substr(NEW.id::text, 1, 8);
  END IF;
  final_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, final_username);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- PROFILES
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES
CREATE POLICY "Roles viewable by everyone"
  ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- BANNED_USERS
CREATE POLICY "Bans viewable by everyone"
  ON public.banned_users FOR SELECT USING (true);
CREATE POLICY "Admins manage bans"
  ON public.banned_users FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- POSTS
CREATE POLICY "Posts viewable by everyone"
  ON public.posts FOR SELECT USING (true);
CREATE POLICY "Authenticated non-banned users can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = author_id AND NOT public.is_banned(auth.uid()));
CREATE POLICY "Authors update own posts"
  ON public.posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors delete own posts"
  ON public.posts FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "Admins delete any post"
  ON public.posts FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update any post"
  ON public.posts FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- COMMENTS
CREATE POLICY "Comments viewable by everyone"
  ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated non-banned users can comment"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = author_id AND NOT public.is_banned(auth.uid()));
CREATE POLICY "Authors delete own comments"
  ON public.comments FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "Admins delete any comment"
  ON public.comments FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- LIKES
CREATE POLICY "Likes viewable by everyone"
  ON public.likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like"
  ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own likes"
  ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- BADGES
CREATE POLICY "Badges viewable by everyone"
  ON public.badges FOR SELECT USING (true);
CREATE POLICY "Admins manage badges"
  ON public.badges FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- USER_BADGES
CREATE POLICY "User badges viewable by everyone"
  ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Admins manage user badges"
  ON public.user_badges FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- STORAGE BUCKET
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Post images publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users upload post images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users delete own post images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins delete any post image"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'post-images' AND public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- SEED INITIAL BADGES
-- =====================================================
INSERT INTO public.badges (name_en, name_ar, description, icon, color, price_cents, type) VALUES
  ('VIP', 'في آي بي', 'Stand out with a golden username', 'crown', '#fbbf24', 999, 'rank'),
  ('Legend', 'أسطورة', 'Legendary purple aura', 'sparkles', '#a855f7', 1999, 'rank'),
  ('Pro Coder', 'مبرمج محترف', 'For elite script creators', 'code', '#06b6d4', 499, 'badge'),
  ('Helper', 'مساعد', 'Always there to help others', 'heart', '#ec4899', 299, 'badge'),
  ('Builder', 'باني', 'Master of FiveM maps', 'hammer', '#10b981', 499, 'badge');

-- =====================================================
-- MODERATOR POLICIES (were missing)
-- =====================================================

-- Moderators can delete any post
CREATE POLICY "Moderators delete any post"
  ON public.posts FOR DELETE
  USING (public.has_role(auth.uid(), 'moderator'));

-- Moderators can delete any comment
CREATE POLICY "Moderators delete any comment"
  ON public.comments FOR DELETE
  USING (public.has_role(auth.uid(), 'moderator'));

-- Moderators can ban users (view bans)
CREATE POLICY "Moderators view bans"
  ON public.banned_users FOR SELECT
  USING (public.has_role(auth.uid(), 'moderator'));

-- Moderators can add bans
CREATE POLICY "Moderators add bans"
  ON public.banned_users FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'moderator'));
