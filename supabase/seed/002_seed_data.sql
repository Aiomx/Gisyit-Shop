-- Seed Data for Store
-- Sample products, categories, and test orders

-- ============================================
-- Categories
-- ============================================
INSERT INTO product_categories (id, name, slug, store_section, sort_order) VALUES
    ('cat-apps-productivity', '效率工具', 'productivity', 'apps', 1),
    ('cat-apps-design', '设计软件', 'design', 'apps', 2),
    ('cat-apps-development', '开发工具', 'development', 'apps', 3),
    ('cat-games-steam', 'Steam 游戏', 'steam', 'games', 1),
    ('cat-games-nintendo', 'Nintendo', 'nintendo', 'games', 2),
    ('cat-games-playstation', 'PlayStation', 'playstation', 'games', 3),
    ('cat-store-accessories', '配件', 'accessories', 'store', 1),
    ('cat-store-peripherals', '外设', 'peripherals', 'store', 2),
    ('cat-overseas-us', '美国代购', 'us', 'overseas', 1),
    ('cat-overseas-jp', '日本代购', 'jp', 'overseas', 2)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Products - Apps
-- ============================================
INSERT INTO products (id, product_code, name, subtitle, description, product_type, delivery_type, category_id, is_active, has_discount) VALUES
    ('prod-ps-2024', 'GIS00000001', 'Adobe Photoshop 2024', '专业图像编辑软件', '业界领先的图像编辑和设计软件，支持AI智能功能', 'app', 'license_key', 'cat-apps-design', true, true),
    ('prod-office-365', 'GIS00000002', 'Microsoft Office 365', '办公套件订阅', '包含Word、Excel、PowerPoint等全套办公软件', 'app', 'license_key', 'cat-apps-productivity', true, false),
    ('prod-jetbrains', 'GIS00000003', 'JetBrains 全家桶', '专业开发工具套件', 'IntelliJ IDEA、WebStorm、PyCharm等全套开发工具', 'app', 'license_key', 'cat-apps-development', true, true),
    ('prod-figma', 'GIS00000004', 'Figma 专业版', 'UI/UX设计协作工具', '云端设计协作平台，支持团队实时协作', 'app', 'license_key', 'cat-apps-design', true, false)
ON CONFLICT (product_code) DO NOTHING;

-- ============================================
-- Products - Games
-- ============================================
INSERT INTO products (id, product_code, name, subtitle, description, product_type, delivery_type, category_id, is_active, has_discount) VALUES
    ('prod-steam-card-100', 'GIS00000010', 'Steam 充值卡 100元', 'Steam钱包充值', '可用于购买Steam平台游戏和DLC', 'game_card', 'cdk', 'cat-games-steam', true, false),
    ('prod-steam-card-500', 'GIS00000011', 'Steam 充值卡 500元', 'Steam钱包充值', '可用于购买Steam平台游戏和DLC', 'game_card', 'cdk', 'cat-games-steam', true, true),
    ('prod-nintendo-eshop', 'GIS00000012', 'Nintendo eShop 点卡', 'Switch游戏商店充值', '可用于购买Nintendo Switch数字游戏', 'game_card', 'cdk', 'cat-games-nintendo', true, false),
    ('prod-ps-plus', 'GIS00000013', 'PlayStation Plus 会员', 'PS会员订阅', '享受免费游戏、在线联机等会员特权', 'game_digital', 'cdk', 'cat-games-playstation', true, true)
ON CONFLICT (product_code) DO NOTHING;

-- ============================================
-- Products - Physical Store
-- ============================================
INSERT INTO products (id, product_code, name, subtitle, description, product_type, delivery_type, category_id, is_active, has_discount) VALUES
    ('prod-airpods-pro', 'GIS00000020', 'AirPods Pro 2', '主动降噪无线耳机', 'Apple最新款降噪耳机，支持空间音频', 'physical', 'shipment', 'cat-store-accessories', true, false),
    ('prod-mx-master', 'GIS00000021', 'Logitech MX Master 3S', '高端无线鼠标', '专业级无线鼠标，支持多设备切换', 'physical', 'shipment', 'cat-store-peripherals', true, true),
    ('prod-keychron-k3', 'GIS00000022', 'Keychron K3 机械键盘', '超薄机械键盘', '75%布局，支持Mac/Windows双系统', 'physical', 'shipment', 'cat-store-peripherals', true, false)
ON CONFLICT (product_code) DO NOTHING;

-- ============================================
-- Products - Overseas
-- ============================================
INSERT INTO products (id, product_code, name, subtitle, description, product_type, delivery_type, category_id, is_active, has_discount) VALUES
    ('prod-us-amazon', 'GIS00000030', '美国亚马逊代购', '美亚商品代购服务', '代购美国亚马逊商品，支持转运', 'overseas', 'manual', 'cat-overseas-us', true, false),
    ('prod-jp-rakuten', 'GIS00000031', '日本乐天代购', '日本乐天商品代购', '代购日本乐天商品，支持直邮', 'overseas', 'manual', 'cat-overseas-jp', true, false)
ON CONFLICT (product_code) DO NOTHING;

-- ============================================
-- Product Images
-- ============================================
INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) VALUES
    ('prod-ps-2024', 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=800', 'Adobe Photoshop 2024', true, 0),
    ('prod-office-365', 'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=800', 'Microsoft Office 365', true, 0),
    ('prod-jetbrains', 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800', 'JetBrains IDE', true, 0),
    ('prod-figma', 'https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=800', 'Figma Design', true, 0),
    ('prod-steam-card-100', 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=800', 'Steam Card', true, 0),
    ('prod-steam-card-500', 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=800', 'Steam Card', true, 0),
    ('prod-nintendo-eshop', 'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800', 'Nintendo eShop', true, 0),
    ('prod-ps-plus', 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800', 'PlayStation Plus', true, 0),
    ('prod-airpods-pro', 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800', 'AirPods Pro', true, 0),
    ('prod-mx-master', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800', 'MX Master Mouse', true, 0),
    ('prod-keychron-k3', 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800', 'Keychron Keyboard', true, 0),
    ('prod-us-amazon', 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=800', 'Amazon US', true, 0),
    ('prod-jp-rakuten', 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800', 'Japan Rakuten', true, 0)
ON CONFLICT DO NOTHING;

-- ============================================
-- Product Prices
-- ============================================
INSERT INTO product_prices (product_id, spec_combination, price_amount, currency, is_active) VALUES
    ('prod-ps-2024', '{"版本": "标准版", "授权": "个人版"}', 299.00, 'CNY', true),
    ('prod-ps-2024', '{"版本": "标准版", "授权": "企业版"}', 599.00, 'CNY', true),
    ('prod-office-365', '{"版本": "家庭版", "期限": "1年"}', 498.00, 'CNY', true),
    ('prod-office-365', '{"版本": "个人版", "期限": "1年"}', 398.00, 'CNY', true),
    ('prod-jetbrains', '{"产品": "全家桶", "期限": "1年"}', 1299.00, 'CNY', true),
    ('prod-jetbrains', '{"产品": "IntelliJ IDEA", "期限": "1年"}', 699.00, 'CNY', true),
    ('prod-figma', '{"版本": "专业版", "期限": "1年"}', 899.00, 'CNY', true),
    ('prod-steam-card-100', '{"面值": "100元"}', 100.00, 'CNY', true),
    ('prod-steam-card-500', '{"面值": "500元"}', 485.00, 'CNY', true),
    ('prod-nintendo-eshop', '{"面值": "299元"}', 299.00, 'CNY', true),
    ('prod-ps-plus', '{"等级": "基础版", "期限": "1年"}', 298.00, 'CNY', true),
    ('prod-ps-plus', '{"等级": "高级版", "期限": "1年"}', 598.00, 'CNY', true),
    ('prod-airpods-pro', '{}', 1899.00, 'CNY', true),
    ('prod-mx-master', '{}', 799.00, 'CNY', true),
    ('prod-keychron-k3', '{"轴体": "红轴"}', 499.00, 'CNY', true),
    ('prod-keychron-k3', '{"轴体": "茶轴"}', 499.00, 'CNY', true),
    ('prod-us-amazon', '{}', 0.00, 'CNY', true),
    ('prod-jp-rakuten', '{}', 0.00, 'CNY', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- Product Specs
-- ============================================
INSERT INTO product_specs (id, product_id, spec_name, sort_order) VALUES
    ('spec-ps-version', 'prod-ps-2024', '版本', 1),
    ('spec-ps-license', 'prod-ps-2024', '授权', 2),
    ('spec-office-version', 'prod-office-365', '版本', 1),
    ('spec-office-period', 'prod-office-365', '期限', 2),
    ('spec-jb-product', 'prod-jetbrains', '产品', 1),
    ('spec-jb-period', 'prod-jetbrains', '期限', 2),
    ('spec-steam-value', 'prod-steam-card-100', '面值', 1),
    ('spec-steam500-value', 'prod-steam-card-500', '面值', 1),
    ('spec-nintendo-value', 'prod-nintendo-eshop', '面值', 1),
    ('spec-ps-tier', 'prod-ps-plus', '等级', 1),
    ('spec-ps-period', 'prod-ps-plus', '期限', 2),
    ('spec-keychron-switch', 'prod-keychron-k3', '轴体', 1)
ON CONFLICT DO NOTHING;

-- ============================================
-- Product Spec Options
-- ============================================
INSERT INTO product_spec_options (spec_id, option_value, sort_order) VALUES
    ('spec-ps-version', '标准版', 1),
    ('spec-ps-license', '个人版', 1),
    ('spec-ps-license', '企业版', 2),
    ('spec-office-version', '家庭版', 1),
    ('spec-office-version', '个人版', 2),
    ('spec-office-period', '1年', 1),
    ('spec-jb-product', '全家桶', 1),
    ('spec-jb-product', 'IntelliJ IDEA', 2),
    ('spec-jb-period', '1年', 1),
    ('spec-steam-value', '100元', 1),
    ('spec-steam500-value', '500元', 1),
    ('spec-nintendo-value', '299元', 1),
    ('spec-ps-tier', '基础版', 1),
    ('spec-ps-tier', '高级版', 2),
    ('spec-ps-period', '1年', 1),
    ('spec-keychron-switch', '红轴', 1),
    ('spec-keychron-switch', '茶轴', 2)
ON CONFLICT DO NOTHING;
