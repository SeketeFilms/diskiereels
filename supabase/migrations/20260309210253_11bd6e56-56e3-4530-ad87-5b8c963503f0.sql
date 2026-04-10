
-- Star packs that users can "buy" (mock system)
CREATE TABLE public.star_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stars_amount integer NOT NULL,
  price_cents integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- User star balances
CREATE TABLE public.star_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Star transactions (gifts, purchases, withdrawals)
CREATE TABLE public.star_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid,
  to_user_id uuid,
  video_id uuid REFERENCES public.videos(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN ('purchase', 'gift', 'earning', 'withdrawal')),
  created_at timestamptz DEFAULT now()
);

-- Creator monetization eligibility
CREATE TABLE public.creator_monetization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  is_eligible boolean DEFAULT false,
  total_stars_earned integer DEFAULT 0,
  total_withdrawn integer DEFAULT 0,
  pending_balance integer DEFAULT 0,
  revenue_split_creator integer DEFAULT 70,
  revenue_split_platform integer DEFAULT 30,
  eligibility_checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.star_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.star_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.star_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_monetization ENABLE ROW LEVEL SECURITY;

-- Star packs: readable by all authenticated
CREATE POLICY "Anyone can view star packs" ON public.star_packs FOR SELECT TO authenticated USING (true);

-- Star balances: users can view/manage their own
CREATE POLICY "Users can view own balance" ON public.star_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own balance" ON public.star_balances FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own balance" ON public.star_balances FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Star transactions: users can view their own (sent or received)
CREATE POLICY "Users can view own transactions" ON public.star_transactions FOR SELECT TO authenticated USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users can create transactions" ON public.star_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);

-- Creator monetization: users can view/manage their own
CREATE POLICY "Users can view own monetization" ON public.creator_monetization FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monetization" ON public.creator_monetization FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monetization" ON public.creator_monetization FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Insert default star packs
INSERT INTO public.star_packs (name, stars_amount, price_cents) VALUES
  ('Starter', 50, 99),
  ('Popular', 200, 299),
  ('Super', 500, 599),
  ('Mega', 1500, 1499);
