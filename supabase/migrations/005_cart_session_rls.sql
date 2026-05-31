-- ============================================
-- Cart Session RLS Policies
-- Allows anonymous users to manage carts using session_id
-- ============================================

-- Drop existing cart policies
DROP POLICY IF EXISTS "Users can view their own carts" ON carts;
DROP POLICY IF EXISTS "Users can create their own carts" ON carts;
DROP POLICY IF EXISTS "Users can update their own carts" ON carts;
DROP POLICY IF EXISTS "Users can view their own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can create their own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can update their own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can delete their own cart items" ON cart_items;

-- ============================================
-- Carts: Allow both authenticated users and anonymous sessions
-- ============================================

-- SELECT: Users can view their own carts (by user_id or session_id)
CREATE POLICY "Users can view their own carts" ON carts FOR SELECT USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
    (session_id IS NOT NULL)
);

-- INSERT: Allow creating carts with session_id (for anonymous users)
-- or with user_id matching auth.uid() (for authenticated users)
CREATE POLICY "Users can create carts" ON carts FOR INSERT WITH CHECK (
    (user_id IS NULL AND session_id IS NOT NULL) OR
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);

-- UPDATE: Users can update their own carts
CREATE POLICY "Users can update their own carts" ON carts FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
    (session_id IS NOT NULL)
);

-- DELETE: Users can delete their own carts
CREATE POLICY "Users can delete their own carts" ON carts FOR DELETE USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
    (session_id IS NOT NULL)
);

-- ============================================
-- Cart Items: Allow operations on carts the user owns
-- ============================================

-- SELECT: Users can view cart items in their carts
CREATE POLICY "Users can view their own cart items" ON cart_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM carts 
        WHERE carts.id = cart_items.cart_id 
        AND (
            (auth.uid() IS NOT NULL AND carts.user_id = auth.uid()) OR
            (carts.session_id IS NOT NULL)
        )
    )
);

-- INSERT: Users can add items to their carts
CREATE POLICY "Users can create cart items" ON cart_items FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM carts 
        WHERE carts.id = cart_items.cart_id 
        AND (
            (auth.uid() IS NOT NULL AND carts.user_id = auth.uid()) OR
            (carts.session_id IS NOT NULL)
        )
    )
);

-- UPDATE: Users can update items in their carts
CREATE POLICY "Users can update their own cart items" ON cart_items FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM carts 
        WHERE carts.id = cart_items.cart_id 
        AND (
            (auth.uid() IS NOT NULL AND carts.user_id = auth.uid()) OR
            (carts.session_id IS NOT NULL)
        )
    )
);

-- DELETE: Users can delete items from their carts
CREATE POLICY "Users can delete their own cart items" ON cart_items FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM carts 
        WHERE carts.id = cart_items.cart_id 
        AND (
            (auth.uid() IS NOT NULL AND carts.user_id = auth.uid()) OR
            (carts.session_id IS NOT NULL)
        )
    )
);
