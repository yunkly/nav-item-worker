-- D1 初始迁移：与原有 db.js 结构一致，含默认数据

-- 主菜单
CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_menus_order ON menus("order");

-- 子菜单
CREATE TABLE IF NOT EXISTS sub_menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  FOREIGN KEY(parent_id) REFERENCES menus(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sub_menus_parent_id ON sub_menus(parent_id);
CREATE INDEX IF NOT EXISTS idx_sub_menus_order ON sub_menus("order");

-- 卡片
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_id INTEGER,
  sub_menu_id INTEGER,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  logo_url TEXT,
  custom_logo_path TEXT,
  desc TEXT,
  "order" INTEGER DEFAULT 0,
  FOREIGN KEY(menu_id) REFERENCES menus(id) ON DELETE CASCADE,
  FOREIGN KEY(sub_menu_id) REFERENCES sub_menus(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cards_menu_id ON cards(menu_id);
CREATE INDEX IF NOT EXISTS idx_cards_sub_menu_id ON cards(sub_menu_id);
CREATE INDEX IF NOT EXISTS idx_cards_order ON cards("order");

-- 用户（含登录信息列）
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  last_login_time TEXT,
  last_login_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 广告
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position TEXT NOT NULL,
  img TEXT NOT NULL,
  url TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ads_position ON ads(position);

-- 友链
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  logo TEXT
);
CREATE INDEX IF NOT EXISTS idx_friends_title ON friends(title);

-- 默认菜单 (id 1-6)
INSERT INTO menus (id, name, "order") VALUES (1, 'Home', 1), (2, 'Ai Stuff', 2), (3, 'Cloud', 3), (4, 'Software', 4), (5, 'Tools', 5), (6, 'Other', 6);

-- 默认子菜单 (parent_id: 2=Ai Stuff, 4=Software, 5=Tools)
INSERT INTO sub_menus (id, parent_id, name, "order") VALUES
  (1, 2, 'AI chat', 1), (2, 2, 'AI tools', 2),
  (3, 5, 'Dev Tools', 1),
  (4, 4, 'Mac', 1), (5, 4, 'iOS', 2), (6, 4, 'Android', 3), (7, 4, 'Windows', 4);

-- 默认卡片（部分示例，menu_id 1=Home, 2=Ai Stuff, 3=Cloud, 4=Software, 5=Tools, 6=Other）
INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, "desc", "order") VALUES
  (1, NULL, 'Baidu', 'https://www.baidu.com', '', '全球最大的中文搜索引擎', 0),
  (1, NULL, 'GitHub', 'https://github.com', '', '全球最大的代码托管平台', 1),
  (1, NULL, 'Cloudflare', 'https://dash.cloudflare.com', '', '全球最大的cdn服务商', 2),
  (2, NULL, 'ChatGPT', 'https://chat.openai.com', 'https://cdn.oaistatic.com/assets/favicon-eex17e9e.ico', 'OpenAI官方AI对话', 0),
  (2, NULL, 'Deepseek', 'https://www.deepseek.com', 'https://cdn.deepseek.com/chat/icon.png', 'Deepseek AI搜索', 1),
  (3, NULL, '阿里云', 'https://www.aliyun.com', 'https://img.alicdn.com/tfs/TB1_ZXuNcfpK1RjSZFOXXa6nFXa-32-32.ico', '阿里云官网', 0),
  (5, NULL, 'JSON工具', 'https://www.json.cn', 'https://img.icons8.com/nolan/128/json.png', 'JSON格式化/校验', 0),
  (6, NULL, 'Gmail', 'https://mail.google.com', 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico', 'Google邮箱', 0);

-- 子菜单下的卡片示例
INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, "desc", "order") VALUES
  (NULL, 1, 'ChatGPT', 'https://chat.openai.com', 'https://cdn.oaistatic.com/assets/favicon-eex17e9e.ico', 'OpenAI官方AI对话', 0),
  (NULL, 2, 'Deepseek', 'https://www.deepseek.com', 'https://cdn.deepseek.com/chat/icon.png', 'Deepseek AI搜索', 0);

-- 默认管理员 admin / 123456（bcrypt 10 轮）
INSERT INTO users (username, password) VALUES ('admin', '$2b$10$peQ5uTujEf2TciKQjjMDc.1vLCgltryThhBz7LLAxXw1xvM3LInfi');

-- 默认友链
INSERT INTO friends (title, url, logo) VALUES
  ('Noodseek图床', 'https://www.nodeimage.com', 'https://www.nodeseek.com/static/image/favicon/favicon-32x32.png'),
  ('Font Awesome', 'https://fontawesome.com', 'https://fontawesome.com/favicon.ico');
