package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"runtime"
	"time"

	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/argon2"
)

const (
	argonMemory      = 64 * 1024
	argonIterations  = 3
	argonParallelism = 2
	argonSaltLength  = 16
	argonKeyLength   = 32
)

func hashPassword(password string) (string, error) {
	salt := make([]byte, argonSaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}

	parallelism := uint8(argonParallelism)
	if runtime.GOMAXPROCS(0) < argonParallelism {
		parallelism = 1
	}
	hash := argon2.IDKey([]byte(password), salt, argonIterations, argonMemory, parallelism, argonKeyLength)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemory,
		argonIterations,
		parallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	), nil
}

func main() {
	wipe := flag.Bool("clean", false, "Clean existing pilot seed data before seeding")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		logger.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	pool, err := database.Open(ctx, databaseURL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	defaultPasswordHash, err := hashPassword("Password123!")
	if err != nil {
		logger.Error("failed to hash default password", "error", err)
		os.Exit(1)
	}

	logger.Info("Starting CreatorOS Pilot Seeder...", "clean", *wipe)

	if *wipe {
		logger.Info("Cleaning pilot cohort data...")
		cleanQuery := `
			TRUNCATE users, audit_logs, announcements CASCADE;
		`
		if _, err := pool.Exec(ctx, cleanQuery); err != nil {
			logger.Error("failed to clean existing pilot data", "error", err)
			os.Exit(1)
		}
	}

	// 1. Seed Roles & Cache Role IDs
	var adminRoleID, clientRoleID, creatorRoleID string
	_ = pool.QueryRow(ctx, "SELECT id FROM roles WHERE code = 'admin'").Scan(&adminRoleID)
	_ = pool.QueryRow(ctx, "SELECT id FROM roles WHERE code = 'client'").Scan(&clientRoleID)
	_ = pool.QueryRow(ctx, "SELECT id FROM roles WHERE code = 'creator'").Scan(&creatorRoleID)

	// Fetch category map
	categories := make(map[string]string)
	catRows, err := pool.Query(ctx, "SELECT id, slug FROM categories")
	if err != nil {
		logger.Error("failed to query categories", "error", err)
		os.Exit(1)
	}
	for catRows.Next() {
		var id, slug string
		if err := catRows.Scan(&id, &slug); err == nil {
			categories[slug] = id
		}
	}
	catRows.Close()

	// Fetch platform map
	platforms := make(map[string]string)
	platRows, err := pool.Query(ctx, "SELECT id, code FROM platforms")
	if err != nil {
		logger.Error("failed to query platforms", "error", err)
		os.Exit(1)
	}
	for platRows.Next() {
		var id, code string
		if err := platRows.Scan(&id, &code); err == nil {
			platforms[code] = id
		}
	}
	platRows.Close()

	// 2. Seed Admin
	adminID := seedUser(ctx, pool, "admin@creatoros.test", "CreatorOS Admin", "en", defaultPasswordHash, adminRoleID)
	logger.Info("Seeded Admin user", "id", adminID, "email", "admin@creatoros.test")

	// 3. Seed 4 Clients
	type clientData struct {
		email  string
		name   string
		locale string
	}
	clientsData := []clientData{
		{"client.tokotech@creatoros.test", "TokoTech Digital", "id"},
		{"client.nusantara@creatoros.test", "Nusantara Flavors", "id"},
		{"client.modestasia@creatoros.test", "ModestStyle Asia", "ms"},
		{"client.travelsea@creatoros.test", "Southeast Escapes", "en"},
	}

	clientIDs := make(map[string]string)
	for _, c := range clientsData {
		cid := seedUser(ctx, pool, c.email, c.name, c.locale, defaultPasswordHash, clientRoleID)
		clientIDs[c.email] = cid
	}
	logger.Info("Seeded 4 pilot brand clients")

	// 4. Seed 15 Creators
	type creatorData struct {
		email       string
		name        string
		locale      string
		slug        string
		headline    string
		bio         string
		city        string
		countryCode string
		categories  []string
		languages   []string
		socials     []struct {
			platform   string
			handle     string
			followers  int64
			avgViews   int64
			engagement int
		}
		serviceTitle string
		serviceDesc  string
		packages     []struct {
			name        string
			desc        string
			priceMinor  int64
			currency    string
			delivery    int
			revisions   int
			sortOrder   int
		}
	}

	creatorsList := []creatorData{
		{
			email:       "nadia.safira@creatoros.test",
			name:        "Nadia Safira",
			locale:      "id",
			slug:        "nadia-safira",
			headline:    "Culinary Explorer & Lifestyle Storyteller",
			bio:         "Authentic culinary reviews, street food guides, and aesthetic lifestyle vlogs across Indonesia. Partnered with 40+ leading F&B brands.",
			city:        "Jakarta",
			countryCode: "ID",
			categories:  []string{"food-lifestyle", "travel"},
			languages:   []string{"id", "en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"instagram", "nadiasafira", 285000, 45000, 420},
				{"tiktok", "nadia.eats", 650000, 120000, 580},
				{"youtube", "nadiasafiravlog", 150000, 32000, 310},
			},
			serviceTitle: "Food Tasting & Restaurant Showcase Video",
			serviceDesc:  "High quality 4K video reel or TikTok showcasing menu highlights, dining ambience, and genuine taste review with natural storytelling.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Starter Reel", "1x 30s Instagram Reel with music & captions", 2500000, "IDR", 5, 1, 0},
				{"Standard Bundle", "1x 60s Reel + 3x Stories with swipe-up link", 4500000, "IDR", 7, 2, 1},
				{"Omnichannel VIP", "1x Dedicated YouTube Video + Reel + TikTok", 8500000, "IDR", 10, 3, 2},
			},
		},
		{
			email:       "reza.pratama@creatoros.test",
			name:        "Reza Pratama",
			locale:      "id",
			slug:        "reza-pratama",
			headline:    "Tech Reviewer & Consumer Electronics Specialist",
			bio:         "In-depth smartphone, laptop, and gadget unboxings. Benchmarks, battery endurance tests, and camera shootouts for tech-savvy audiences.",
			city:        "Bandung",
			countryCode: "ID",
			categories:  []string{"technology", "gaming"},
			languages:   []string{"id", "en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"youtube", "rezapratamatech", 420000, 95000, 480},
				{"instagram", "rezapratama_id", 190000, 28000, 350},
			},
			serviceTitle: "Comprehensive Gadget Review & Benchmark",
			serviceDesc:  "Professional studio unboxing and 1-week usage review with cinematic B-roll and clear consumer recommendations.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Short Feature", "60s Short or Reel focusing on 3 standout features", 3000000, "IDR", 5, 1, 0},
				{"Dedicated YouTube", "8-12 minute full review with benchmarks & b-roll", 7500000, "IDR", 10, 2, 1},
				{"Ultimate Launch Sponsor", "Dedicated video + Shorts cutdown + 5x Instagram stories", 12000000, "IDR", 14, 3, 2},
			},
		},
		{
			email:       "siti.aminah@creatoros.test",
			name:        "Siti Aminah",
			locale:      "ms",
			slug:        "siti-aminah",
			headline:    "Modest Fashion & Halal Beauty Influencer",
			bio:         "Hijab styling tips, modest OOTD inspiration, and clean halal skincare routines based in Kuala Lumpur. Inspiring modern women across SEA.",
			city:        "Kuala Lumpur",
			countryCode: "MY",
			categories:  []string{"fashion", "beauty"},
			languages:   []string{"ms", "en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"instagram", "sitiaminah.my", 310000, 52000, 510},
				{"tiktok", "sitiaminah_hijab", 480000, 98000, 620},
			},
			serviceTitle: "Modest Outfit Styling & Lookbook Reel",
			serviceDesc:  "High-aesthetic fashion lookbook showcasing 3-5 styling concepts with natural transitions and brand tagging.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Single Look Reel", "1x 30s styling reel + 2 story slides", 95000, "MYR", 4, 1, 0}, // 950 MYR
				{"Lookbook Duo", "2x reels showcasing day & night looks", 180000, "MYR", 7, 2, 1},    // 1800 MYR
				{"Campaign Collection", "3x reels + 1 carousel + rights for paid ads", 320000, "MYR", 10, 2, 2},
			},
		},
		{
			email:       "budi.santoso@creatoros.test",
			name:        "Budi Santoso",
			locale:      "id",
			slug:        "budi-santoso",
			headline:    "Java Street Food & Heritage Culture Storyteller",
			bio:         "Documenting hidden culinary gems and traditional food makers across East and Central Java. Vibrant, energetic, and candid style.",
			city:        "Surabaya",
			countryCode: "ID",
			categories:  []string{"food-lifestyle"},
			languages:   []string{"id"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"tiktok", "budi.streetfood", 520000, 110000, 640},
				{"youtube", "budisantosokuliner", 180000, 45000, 390},
			},
			serviceTitle: "Authentic Street Food Discovery Feature",
			serviceDesc:  "Energetic on-location food review highlighting history, preparation technique, and tasting reactions.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"TikTok Feature", "1x energetic TikTok 60s video with voiceover", 2000000, "IDR", 4, 1, 0},
				{"Multi-Platform Duo", "1x TikTok + 1x Instagram Reel + Story mention", 3500000, "IDR", 7, 2, 1},
				{"Full Culinary Profile", "YouTube 10 min feature + 2x vertical clips", 6500000, "IDR", 12, 2, 2},
			},
		},
		{
			email:       "clara.tan@creatoros.test",
			name:        "Clara Tan",
			locale:      "en",
			slug:        "clara-tan",
			headline:    "Luxury Travel & Boutique Stay Curator",
			bio:         "Connecting discerning travelers with architectural boutique stays, luxury resorts, and bespoke wellness retreats across Asia-Pacific.",
			city:        "Singapore",
			countryCode: "SG",
			categories:  []string{"travel", "food-lifestyle"},
			languages:   []string{"en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"instagram", "claratan_escapes", 175000, 38000, 460},
				{"youtube", "claratanwander", 88000, 24000, 380},
			},
			serviceTitle: "Resort & Hotel Experience Cinematic Vignette",
			serviceDesc:  "Architectural drone shots, interior room tour, dining experience, and sunrise/sunset aesthetic moments.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Story Vignette", "5x high-res curated Instagram stories with booking tag", 60000, "USD", 3, 1, 0}, // $600
				{"Cinematic Reel", "1x 4K reel with drone photography & sound design", 120000, "USD", 7, 2, 1},     // $1200
				{"Full Resort Feature", "1x YouTube vignette + 2x reels + 10x photo assets", 240000, "USD", 14, 2, 2},
			},
		},
		{
			email:       "dimas.setiawan@creatoros.test",
			name:        "Dimas Setiawan",
			locale:      "id",
			slug:        "dimas-setiawan",
			headline:    "Esports Caster & Mobile Gaming Streamer",
			bio:         "Pro gaming commentator, tournament host, and mobile esports creator. High engagement with Gen Z and competitive gaming communities.",
			city:        "Yogyakarta",
			countryCode: "ID",
			categories:  []string{"gaming", "technology"},
			languages:   []string{"id", "en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"youtube", "dimasgamingid", 550000, 130000, 520},
				{"tiktok", "dimas.esports", 380000, 75000, 490},
			},
			serviceTitle: "Mobile Game Gameplay & In-Game Event Showcase",
			serviceDesc:  "Exciting gameplay highlight, hero guide, or gacha pull stream segment showcasing seasonal brand tie-ins.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Highlight Short", "1x 60s gameplay clip with comedic commentary", 2200000, "IDR", 3, 1, 0},
				{"Dedicated Video", "1x 10-minute gameplay showcase with download CTA", 5000000, "IDR", 7, 2, 1},
				{"Stream & Video Duo", "2-hour sponsored live stream + 1 dedicated VOD", 9000000, "IDR", 10, 2, 2},
			},
		},
		{
			email:       "fitri.nurhaliza@creatoros.test",
			name:        "Fitri Nurhaliza",
			locale:      "ms",
			slug:        "fitri-nurhaliza",
			headline:    "Everyday Modest Chic & Lifestyle Vlogs",
			bio:         "University student and lifestyle creator sharing budget-friendly modest fashion finds, stationery, and café hopping in Penang.",
			city:        "George Town",
			countryCode: "MY",
			categories:  []string{"fashion", "food-lifestyle"},
			languages:   []string{"ms", "en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"tiktok", "fitrinurhaliza_", 210000, 48000, 560},
				{"instagram", "fitri.looks", 95000, 18000, 440},
			},
			serviceTitle: "Campus & Everyday Modest OOTD Video",
			serviceDesc:  "Trendy transition video styling outfits for university classes, work-from-cafe, or weekend brunch.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Quick Transition", "1x 15-30s fast-cut TikTok transition reel", 50000, "MYR", 3, 1, 0},
				{"Weekend Lookbook", "1x 60s reel showcasing 3 outfits + link in bio", 95000, "MYR", 5, 2, 1},
				{"Monthly Brand Ambassador", "3x reels spaced over 3 weeks", 220000, "MYR", 21, 2, 2},
			},
		},
		{
			email:       "arif.hidayat@creatoros.test",
			name:        "Arif Hidayat",
			locale:      "id",
			slug:        "arif-hidayat",
			headline:    "Calisthenics Coach & Functional Fitness Creator",
			bio:         "Transforming everyday bodies with bodyweight training, nutrition advice, and gym mindset. Certified personal trainer and fitness author.",
			city:        "Jakarta",
			countryCode: "ID",
			categories:  []string{"fitness-wellness"},
			languages:   []string{"id", "en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"instagram", "arifcalisthenics", 340000, 68000, 490},
				{"youtube", "arifhidayatfitness", 220000, 52000, 410},
			},
			serviceTitle: "Fitness Product Demonstration & Form Guide",
			serviceDesc:  "Educational workout tutorial demonstrating correct biomechanics with client equipment, activewear, or nutrition supplements.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Exercise Tutorial Reel", "1x technique breakdown reel featuring product", 2800000, "IDR", 5, 1, 0},
				{"Complete Workout Video", "1x 8-12 min YouTube routine with integrated sponsor", 6000000, "IDR", 8, 2, 1},
				{"30-Day Fitness Challenge", "Weekly progress posts + stories + workout guide PDF", 12000000, "IDR", 30, 2, 2},
			},
		},
		{
			email:       "maya.lestari@creatoros.test",
			name:        "Maya Lestari",
			locale:      "id",
			slug:        "maya-lestari",
			headline:    "Clean Skincare Advocate & Organic Beauty Chemist",
			bio:         "Educating Southeast Asian consumers on ingredient safety, SPF protection, and barrier repair. Known for honest non-sponsored comparisons.",
			city:        "Denpasar",
			countryCode: "ID",
			categories:  []string{"beauty"},
			languages:   []string{"id", "en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"tiktok", "mayaskinedu", 490000, 115000, 680},
				{"instagram", "mayalestaribeauty", 260000, 42000, 450},
			},
			serviceTitle: "Dermatological Ingredient Breakdown & Review",
			serviceDesc:  "Close-up macro texture shots, clinical ingredient analysis, and 14-day wear test demonstration.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Ingredient Spotlight", "1x 60s educational TikTok analyzing active components", 3500000, "IDR", 5, 1, 0},
				{"14-Day Before & After", "Carousel breakdown + 2x reels tracking progress", 7000000, "IDR", 18, 2, 1},
				{"Signature Brand Takeover", "3x reels + 1 live Q&A + exclusivity lock", 14000000, "IDR", 21, 2, 2},
			},
		},
		{
			email:       "kevin.wijaya@creatoros.test",
			name:        "Kevin Wijaya",
			locale:      "id",
			slug:        "kevin-wijaya",
			headline:    "Desk Setup Minimalist & Productivity Specialist",
			bio:         "Aesthetic desk setup tours, mechanical keyboards, ergonomic gear, and software workflows for remote developers and creators.",
			city:        "Jakarta",
			countryCode: "ID",
			categories:  []string{"technology"},
			languages:   []string{"id", "en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"youtube", "kevinwijayatech", 195000, 48000, 520},
				{"instagram", "kevinw_setups", 145000, 31000, 460},
			},
			serviceTitle: "Cinematic Desk Setup Integration & B-Roll",
			serviceDesc:  "Crisp, macro 4K cinematography showcasing tech hardware seamlessly integrated into a modern minimalist workspace.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Macro Spotlight Reel", "1x 30s moody aesthetic B-roll reel with sound design", 2500000, "IDR", 5, 1, 0},
				{"Setup Tour Feature", "1x dedicated video section (2-3 min) in setup tour", 5500000, "IDR", 8, 2, 1},
				{"Full Product Review", "1x 8-minute dedicated video + high-res photo pack", 9500000, "IDR", 12, 2, 2},
			},
		},
		{
			email:       "anita.kusuma@creatoros.test",
			name:        "Anita Kusuma",
			locale:      "id",
			slug:        "anita-kusuma",
			headline:    "Positive Parenting Coach & Montessori Mom",
			bio:         "Practical parenting strategies, kid-friendly meal planning, and sensory activities. Warm, supportive community of 300k+ modern parents.",
			city:        "Semarang",
			countryCode: "ID",
			categories:  []string{"parenting-family", "food-lifestyle"},
			languages:   []string{"id"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"instagram", "anita_parenting", 320000, 55000, 540},
				{"tiktok", "mamanita.tips", 240000, 46000, 480},
			},
			serviceTitle: "Family Activity & Educational Toy Demonstration",
			serviceDesc:  "Authentic family interaction video showing how product enriches child development and parent-child connection.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Story Activity Demo", "3x stories demonstrating daily use with swipe link", 1800000, "IDR", 3, 1, 0},
				{"Reel Demonstration", "1x 60s educational reel on learning outcomes", 3800000, "IDR", 6, 2, 1},
				{"Comprehensive Campaign", "2x reels + 1 carousel guide + story series", 7500000, "IDR", 10, 2, 2},
			},
		},
		{
			email:       "adrian.khoo@creatoros.test",
			name:        "Adrian Khoo",
			locale:      "en",
			slug:        "adrian-khoo",
			headline:    "Adventure Filmmaker & Island Explorer",
			bio:         "Scuba diving adventures, rainforest treks, and cultural expeditions across Southeast Asia. High-production aerial and underwater footage.",
			city:        "Johor Bahru",
			countryCode: "MY",
			categories:  []string{"travel"},
			languages:   []string{"en", "ms"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"youtube", "adriankhoofilms", 280000, 72000, 580},
				{"instagram", "adriankhoo.travel", 160000, 36000, 470},
			},
			serviceTitle: "Cinematic Outdoor Adventure Brand Video",
			serviceDesc:  "Breath-taking aerial drone and action footage putting rugged gear to the ultimate test in tropical wild environments.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Adventure Clip", "1x 30s high-octane drone & action teaser", 80000, "MYR", 5, 1, 0},
				{"Expedition Episode", "1x 6-8 minute documentary-style travel episode", 220000, "MYR", 12, 2, 1},
				{"Global Commercial Rights", "Full 4K commercial cut + RAW assets for ads", 450000, "MYR", 15, 3, 2},
			},
		},
		{
			email:       "sarah.putri@creatoros.test",
			name:        "Sarah Putri",
			locale:      "id",
			slug:        "sarah-putri",
			headline:    "Home Cooking Enthusiast & Modern Nusantara Baker",
			bio:         "Step-by-step baking tutorials, heritage Indonesian desserts, and comforting weekday dinners. Tested recipes made accessible to everyone.",
			city:        "Medan",
			countryCode: "ID",
			categories:  []string{"food-lifestyle"},
			languages:   []string{"id"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"tiktok", "sarahputricooks", 410000, 92000, 590},
				{"instagram", "sarah.dapur", 185000, 34000, 430},
			},
			serviceTitle: "Step-by-Step Recipe Video with Client Ingredients",
			serviceDesc:  "Crisp, top-down recipe tutorial emphasizing product ease-of-use and mouthwatering finished dish reveal.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"Quick Recipe Reel", "1x 45s top-down recipe video with text ingredients", 2200000, "IDR", 4, 1, 0},
				{"Full Recipe Tutorial", "1x 90s detailed guide + recipe card in caption", 3800000, "IDR", 6, 2, 1},
				{"Holiday Baking Special", "2x recipe reels + 1 shopping haul story set", 6800000, "IDR", 10, 2, 2},
			},
		},
		{
			email:       "daniel.chua@creatoros.test",
			name:        "Daniel Chua",
			locale:      "en",
			slug:        "daniel-chua",
			headline:    "Next-Gen Mobile Hardware & Handheld Enthusiast",
			bio:         "Deep-dive analysis of mobile gaming controllers, handheld consoles, and thermal performance benchmarks. Straight to the facts.",
			city:        "Singapore",
			countryCode: "SG",
			categories:  []string{"technology", "gaming"},
			languages:   []string{"en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"youtube", "danielchuagaming", 165000, 42000, 480},
				{"tiktok", "daniel.techcheck", 290000, 68000, 540},
			},
			serviceTitle: "Mobile Gaming Benchmark & Thermal Test",
			serviceDesc:  "Framerate charts, temperature readings, and ergonomics breakdown tested against demanding titles.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"FPS Benchmark Short", "60s summary of latency and sustained framerate", 45000, "USD", 4, 1, 0},
				{"Dedicated Hardware Review", "8-minute hardware breakdown with teardown", 110000, "USD", 8, 2, 1},
				{"Sponsor Segment + Short", "2-minute integrated sponsor + dedicated vertical cut", 180000, "USD", 10, 2, 2},
			},
		},
		{
			email:       "ayu.wardani@creatoros.test",
			name:        "Ayu Wardani",
			locale:      "id",
			slug:        "ayu-wardani",
			headline:    "Mindfulness Practitioner & Vinyasa Yoga Teacher",
			bio:         "Morning routines, breathwork practices, and mindful movement for busy urban professionals. Promoting holistic balance and inner stillness.",
			city:        "Malang",
			countryCode: "ID",
			categories:  []string{"fitness-wellness"},
			languages:   []string{"id", "en"},
			socials: []struct {
				platform   string
				handle     string
				followers  int64
				avgViews   int64
				engagement int
			}{
				{"instagram", "ayuwardani_yoga", 195000, 36000, 510},
				{"tiktok", "ayuyogalife", 280000, 62000, 570},
			},
			serviceTitle: "Morning Yoga Flow & Mindful Lifestyle Integration",
			serviceDesc:  "Calm, aesthetic yoga flow featuring eco-friendly mats, athletic apparel, or herbal wellness teas in morning natural light.",
			packages: []struct {
				name        string
				desc        string
				priceMinor  int64
				currency    string
				delivery    int
				revisions   int
				sortOrder   int
			}{
				{"15-Min Flow Reel", "1x gentle morning stretch reel featuring activewear", 2000000, "IDR", 4, 1, 0},
				{"Full Guided Routine", "1x 15-minute complete class video on YouTube/IGTV", 4500000, "IDR", 7, 2, 1},
				{"7-Day Wellness Series", "3x reels + daily mindfulness stories", 8500000, "IDR", 12, 2, 2},
			},
		},
	}

	creatorIDs := make(map[string]string)
	creatorServiceMap := make(map[string]string)
	creatorPackageMap := make(map[string]string)

	type portfolioSeed struct {
		title        string
		desc         string
		mediaURL     string
		thumbnailURL string
		sortOrder    int
	}

	creatorPortfolios := map[string][]portfolioSeed{
		"nadia-safira": {
			{
				title:        "Jakarta Street Food & Hidden Gems Crawl",
				desc:         "Aesthetic 4K cinematic culinary vlog across South Jakarta with 3.2x benchmark engagement.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
			{
				title:        "Heritage Coffee & Artisanal Bakery ASMR",
				desc:         "Warm morning lighting, sourdough crumb structure review, and sensory taste exploration.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80",
				sortOrder:    1,
			},
		},
		"reza-pratama": {
			{
				title:        "Flagship Smartphone Teardown & Stress Test",
				desc:         "Cinematic macro 4K unboxing, sustained gaming thermal benchmarks, and camera shootout.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
			{
				title:        "Next-Gen Pro Laptop Developer Benchmark",
				desc:         "Real-world compilation speeds, battery endurance, and thermal dissipation teardown.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
				sortOrder:    1,
			},
			{
				title:        "Audiophile Studio ANC Wireless Earbuds",
				desc:         "Binaural noise cancellation testing, frequency curve measurement, and comfort review.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80",
				sortOrder:    2,
			},
		},
		"siti-aminah": {
			{
				title:        "Raya Festive Modest Lookbook 2026",
				desc:         "Silk hijab draping tutorials with soft pastel color palettes and elegant daytime transitions.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
			{
				title:        "Clean Halal Morning Skincare Ritual",
				desc:         "Micro-glow skin texture check, SPF reapplication routine, and hypoallergenic formulas.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80",
				sortOrder:    1,
			},
		},
		"budi-santoso": {
			{
				title:        "Surabaya Midnight Roasted Duck Special",
				desc:         "High-energy candid culinary review at iconic heritage food stall with authentic commentary.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
			{
				title:        "East Java Traditional Spice Heritage Tour",
				desc:         "Exploring age-old mortar spice grinding and secret family recipes across Gresik and Surabaya.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80",
				sortOrder:    1,
			},
		},
		"clara-tan": {
			{
				title:        "Luxury Sentosa Pool Villa Cinematic Tour",
				desc:         "Architectural 4K drone cinematography, interior tour, and sunrise ambient sound design.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
			{
				title:        "Boutique Wellness Sanctuary Escape",
				desc:         "Meditation garden walkthrough, organic farm-to-table dining, and wellness spa feature.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80",
				sortOrder:    1,
			},
		},
		"dimas-setiawan": {
			{
				title:        "Esports Mobile Championship Highlights",
				desc:         "Exciting commentary, hero analysis, and high-level clutch plays in tournament finals.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
		},
		"fitri-nurhaliza": {
			{
				title:        "University Campus Modest Lookbook",
				desc:         "Fast-cut transition reel showing versatile modest outfits for campus and weekend brunch.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
		},
		"arif-hidayat": {
			{
				title:        "Functional Calisthenics & Form Blueprint",
				desc:         "Step-by-step biomechanical breakdown of muscle-ups and weighted dips with activewear.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
		},
		"maya-lestari": {
			{
				title:        "14-Day Barrier Repair Ingredient Analysis",
				desc:         "Macro clinical texture tests, hydration meter readings, and honest non-sponsored verdict.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
		},
		"kevin-wijaya": {
			{
				title:        "Minimalist Ergonomic Workspace Tour",
				desc:         "Moody 4K cinematography showcasing dual monitors, custom desk shelf, and cable management.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
		},
		"anita-kusuma": {
			{
				title:        "Montessori Early Development Sensory Play",
				desc:         "Warm parent-child interaction video highlighting open-ended developmental wooden toys.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
		},
		"adrian-khoo": {
			{
				title:        "Tropical Island Diving & Marine Expedition",
				desc:         "4K underwater coral reef cinematography putting rugged waterproof equipment to the test.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
		},
		"sarah-putri": {
			{
				title:        "Heritage Layer Cake Step-by-Step Tutorial",
				desc:         "Crisp top-down culinary lighting and proven proportions for traditional layered sponge cake.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
		},
		"daniel-chua": {
			{
				title:        "Handheld Gaming Console Thermal & FPS Stress Test",
				desc:         "Detailed frame pacing diagnostics, thermal imaging, and analog trigger responsiveness.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
		},
		"ayu-wardani": {
			{
				title:        "Morning Sun Salutation in Malang Pine Valley",
				desc:         "Gentle grounding movement routine filmed in natural morning golden hour with sound bath.",
				mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
				thumbnailURL: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
				sortOrder:    0,
			},
		},
	}

	for _, c := range creatorsList {
		uid := seedUser(ctx, pool, c.email, c.name, c.locale, defaultPasswordHash, creatorRoleID)
		creatorIDs[c.slug] = uid

		// Insert profile
		_, err = pool.Exec(ctx, `
			INSERT INTO creator_profiles (user_id, slug, headline, bio, city, country_code, verification_status, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'verified', now())
			ON CONFLICT (user_id) DO UPDATE SET
				slug = EXCLUDED.slug,
				headline = EXCLUDED.headline,
				bio = EXCLUDED.bio,
				city = EXCLUDED.city,
				country_code = EXCLUDED.country_code,
				verification_status = 'verified',
				updated_at = now()
		`, uid, c.slug, c.headline, c.bio, c.city, c.countryCode)
		if err != nil {
			logger.Error("failed to insert creator profile", "slug", c.slug, "error", err)
			continue
		}

		// Insert categories
		for _, catSlug := range c.categories {
			if catID, exists := categories[catSlug]; exists {
				_, _ = pool.Exec(ctx, `
					INSERT INTO creator_categories (creator_user_id, category_id)
					VALUES ($1, $2) ON CONFLICT DO NOTHING
				`, uid, catID)
			}
		}

		// Insert languages
		for _, lang := range c.languages {
			_, _ = pool.Exec(ctx, `
				INSERT INTO creator_languages (creator_user_id, language_code)
				VALUES ($1, $2) ON CONFLICT DO NOTHING
			`, uid, lang)
		}

		// Insert socials
		for _, s := range c.socials {
			if platID, exists := platforms[s.platform]; exists {
				profileURL := fmt.Sprintf("https://%s.com/%s", s.platform, s.handle)
				_, _ = pool.Exec(ctx, `
					INSERT INTO creator_social_accounts (
						creator_user_id, platform_id, handle, profile_url,
						follower_count, average_views, engagement_bps
					)
					VALUES ($1, $2, $3, $4, $5, $6, $7)
					ON CONFLICT (creator_user_id, platform_id) DO UPDATE SET
						handle = EXCLUDED.handle,
						profile_url = EXCLUDED.profile_url,
						follower_count = EXCLUDED.follower_count,
						average_views = EXCLUDED.average_views,
						engagement_bps = EXCLUDED.engagement_bps
				`, uid, platID, s.handle, profileURL, s.followers, s.avgViews, s.engagement)
			}
		}

		// Clear existing portfolios to ensure idempotency
		_, _ = pool.Exec(ctx, `DELETE FROM creator_portfolios WHERE creator_user_id = $1`, uid)

		// Insert realistic portfolios
		ports, exists := creatorPortfolios[c.slug]
		if !exists || len(ports) == 0 {
			ports = []portfolioSeed{
				{
					title:        "Featured Brand Showcase",
					desc:         "High-performing commercial deliverable with 2.4x benchmark engagement",
					mediaURL:     "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
					thumbnailURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
					sortOrder:    0,
				},
			}
		}
		for _, port := range ports {
			_, _ = pool.Exec(ctx, `
				INSERT INTO creator_portfolios (
					creator_user_id, title, description, media_url, thumbnail_url, sort_order
				)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, uid, port.title, port.desc, port.mediaURL, port.thumbnailURL, port.sortOrder)
		}

		// Insert wallet
		_, _ = pool.Exec(ctx, `
			INSERT INTO creator_wallets (creator_user_id, currency, available_balance_minor, escrow_balance_minor)
			VALUES ($1, 'IDR', 0, 0)
			ON CONFLICT DO NOTHING
		`, uid)

		// Insert service & packages
		serviceSlug := fmt.Sprintf("%s-package", c.slug)
		var serviceID string
		err = pool.QueryRow(ctx, `
			INSERT INTO creator_services (
				creator_user_id, slug, title, description, status, published_at
			)
			VALUES ($1, $2, $3, $4, 'published', now())
			ON CONFLICT (creator_user_id, slug) DO UPDATE SET
				title = EXCLUDED.title,
				description = EXCLUDED.description,
				status = 'published'
			RETURNING id
		`, uid, serviceSlug, c.serviceTitle, c.serviceDesc).Scan(&serviceID)
		if err == nil {
			creatorServiceMap[c.slug] = serviceID
			for _, pkg := range c.packages {
				var pkgID string
				pErr := pool.QueryRow(ctx, `
					INSERT INTO service_packages (
						service_id, name, description, price_minor, currency,
						delivery_days, revision_limit, sort_order
					)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
					ON CONFLICT (service_id, sort_order) DO UPDATE SET
						name = EXCLUDED.name,
						price_minor = EXCLUDED.price_minor,
						currency = EXCLUDED.currency
					RETURNING id
				`, serviceID, pkg.name, pkg.desc, pkg.priceMinor, pkg.currency, pkg.delivery, pkg.revisions, pkg.sortOrder).Scan(&pkgID)
				if pErr == nil && pkg.sortOrder == 1 {
					// save standard package ID for order simulation
					creatorPackageMap[c.slug] = pkgID
				}
			}
		}
	}
	logger.Info("Seeded 15 verified creators with profiles, socials, packages, and wallets")

	// 5. Seed 3 Pilot Campaigns
	tokotechID := clientIDs["client.tokotech@creatoros.test"]
	nusantaraID := clientIDs["client.nusantara@creatoros.test"]
	modestID := clientIDs["client.modestasia@creatoros.test"]

	// Campaign 1: TokoTech Mega Launch Q4
	var camp1ID string
	err = pool.QueryRow(ctx, `
		INSERT INTO campaigns (
			client_user_id, title, description, objective, budget_minor, currency,
			target_creators_count, deadline_at, status
		)
		VALUES ($1, 'TokoTech Flagship Smartphone Launch Q4', 'Looking for tech reviewers and unboxers to produce launch reviews for our new flagship device.', 'conversions', 25000000, 'IDR', 3, now() + interval '30 days', 'active')
		RETURNING id
	`, tokotechID).Scan(&camp1ID)
	if err == nil {
		techCatID := categories["technology"]
		ytPlatID := platforms["youtube"]
		_, _ = pool.Exec(ctx, `
			INSERT INTO campaign_requirements (campaign_id, category_id, platform_id, min_followers, min_engagement_bps, deliverable_format)
			VALUES ($1, $2, $3, 100000, 300, 'video')
			ON CONFLICT (campaign_id) DO NOTHING
		`, camp1ID, techCatID, ytPlatID)

		// Invitations: Reza (accepted), Kevin (invited)
		rezaUID := creatorIDs["reza-pratama"]
		kevinUID := creatorIDs["kevin-wijaya"]
		_, _ = pool.Exec(ctx, `
			INSERT INTO campaign_invitations (campaign_id, creator_user_id, status, offered_fee_minor, currency, pitch_note, responded_at)
			VALUES ($1, $2, 'accepted', 7500000, 'IDR', 'Reza, your benchmarks are gold standard. We want you for our launch!', now() - interval '2 days')
			ON CONFLICT (campaign_id, creator_user_id) DO NOTHING
		`, camp1ID, rezaUID)
		_, _ = pool.Exec(ctx, `
			INSERT INTO campaign_invitations (campaign_id, creator_user_id, status, offered_fee_minor, currency, pitch_note)
			VALUES ($1, $2, 'invited', 5500000, 'IDR', 'Kevin, love your desk setups. Would fit perfectly in your next setup tour.')
			ON CONFLICT (campaign_id, creator_user_id) DO NOTHING
		`, camp1ID, kevinUID)
	}

	// Campaign 2: Nusantara Kuliner Festival
	var camp2ID string
	err = pool.QueryRow(ctx, `
		INSERT INTO campaigns (
			client_user_id, title, description, objective, budget_minor, currency,
			target_creators_count, deadline_at, status
		)
		VALUES ($1, 'Nusantara Street Food Heritage Campaign', 'Highlighting traditional spice blends and culinary recipes across Java.', 'brand_awareness', 15000000, 'IDR', 3, now() + interval '21 days', 'active')
		RETURNING id
	`, nusantaraID).Scan(&camp2ID)
	if err == nil {
		foodCatID := categories["food-lifestyle"]
		ttPlatID := platforms["tiktok"]
		_, _ = pool.Exec(ctx, `
			INSERT INTO campaign_requirements (campaign_id, category_id, platform_id, min_followers, min_engagement_bps, deliverable_format)
			VALUES ($1, $2, $3, 200000, 400, 'mixed')
			ON CONFLICT (campaign_id) DO NOTHING
		`, camp2ID, foodCatID, ttPlatID)

		nadiaUID := creatorIDs["nadia-safira"]
		budiUID := creatorIDs["budi-santoso"]
		_, _ = pool.Exec(ctx, `
			INSERT INTO campaign_invitations (campaign_id, creator_user_id, status, offered_fee_minor, currency, pitch_note, responded_at)
			VALUES ($1, $2, 'accepted', 4500000, 'IDR', 'Nadia, we would love a street food crawl video featuring our bumbu.', now() - interval '3 days')
			ON CONFLICT (campaign_id, creator_user_id) DO NOTHING
		`, camp2ID, nadiaUID)
		_, _ = pool.Exec(ctx, `
			INSERT INTO campaign_invitations (campaign_id, creator_user_id, status, offered_fee_minor, currency, pitch_note)
			VALUES ($1, $2, 'invited', 3500000, 'IDR', 'Budi, your Surabaya street food videos are incredible. Let us collaborate!')
			ON CONFLICT (campaign_id, creator_user_id) DO NOTHING
		`, camp2ID, budiUID)
	}

	// Campaign 3: Raya Modest Collection
	var camp3ID string
	err = pool.QueryRow(ctx, `
		INSERT INTO campaigns (
			client_user_id, title, description, objective, budget_minor, currency,
			target_creators_count, deadline_at, status
		)
		VALUES ($1, 'ModestStyle Raya 2026 Collection', 'Seasonal hijab and festive modest attire launch across Malaysia and Singapore.', 'ugc_creation', 800000, 'MYR', 2, now() + interval '45 days', 'active')
		RETURNING id
	`, modestID).Scan(&camp3ID)
	if err == nil {
		fashCatID := categories["fashion"]
		igPlatID := platforms["instagram"]
		_, _ = pool.Exec(ctx, `
			INSERT INTO campaign_requirements (campaign_id, category_id, platform_id, min_followers, min_engagement_bps, deliverable_format)
			VALUES ($1, $2, $3, 100000, 450, 'carousel')
			ON CONFLICT (campaign_id) DO NOTHING
		`, camp3ID, fashCatID, igPlatID)

		sitiUID := creatorIDs["siti-aminah"]
		_, _ = pool.Exec(ctx, `
			INSERT INTO campaign_invitations (campaign_id, creator_user_id, status, offered_fee_minor, currency, pitch_note, responded_at)
			VALUES ($1, $2, 'accepted', 180000, 'MYR', 'Siti, your modest styling lookbooks are gorgeous. We want you for our Raya banner.', now() - interval '1 day')
			ON CONFLICT (campaign_id, creator_user_id) DO NOTHING
		`, camp3ID, sitiUID)
	}
	logger.Info("Seeded 3 pilot campaigns with criteria and creator invitations")

	// 6. Seed Real Orders Across Lifecycle States
	// Order A: pending_acceptance (TokoTech -> Reza)
	seedPilotOrder(ctx, pool, tokotechID, creatorIDs["reza-pratama"], creatorServiceMap["reza-pratama"], creatorPackageMap["reza-pratama"], "Standard Bundle", 7500000, "IDR", 7, 2, "pending_acceptance", "Please review our new flagship phone with stress testing on the cooling system.")

	// Order B: accepted (Nusantara -> Budi)
	seedPilotOrder(ctx, pool, nusantaraID, creatorIDs["budi-santoso"], creatorServiceMap["budi-santoso"], creatorPackageMap["budi-santoso"], "Multi-Platform Duo", 3500000, "IDR", 7, 2, "accepted", "Feature our traditional sambal seasoning with Surabaya roasted duck street vendors.")

	// Order C: in_progress with v1 submission (ModestStyle -> Siti)
	orderCID := seedPilotOrder(ctx, pool, modestID, creatorIDs["siti-aminah"], creatorServiceMap["siti-aminah"], creatorPackageMap["siti-aminah"], "Lookbook Duo", 180000, "MYR", 7, 2, "in_progress", "Produce two high aesthetic lookbook reels showcasing our Raya pastel hijab collection.")
	seedDeliverable(ctx, pool, orderCID, creatorIDs["siti-aminah"], 1, "First Cut Lookbook Reel", "Here is the first cut featuring the pastel silk scarf and daytime styling.", "submitted")

	// Order D: in_progress with revision request (TokoTech -> Kevin)
	orderDID := seedPilotOrder(ctx, pool, tokotechID, creatorIDs["kevin-wijaya"], creatorServiceMap["kevin-wijaya"], creatorPackageMap["kevin-wijaya"], "Setup Tour Feature", 5500000, "IDR", 8, 2, "in_progress", "Showcase the dual-monitor arm and minimalist cable management tray in your workspace.")
	subDID := seedDeliverable(ctx, pool, orderDID, creatorIDs["kevin-wijaya"], 1, "Desk Setup B-Roll Cut 1", "Initial draft showing wide and macro shots.", "revision_requested")
	_, _ = pool.Exec(ctx, `
		INSERT INTO submission_revisions (submission_id, order_id, client_user_id, revision_number, feedback)
		VALUES ($1, $2, $3, 1, 'Great lighting! Could you adjust the focus on the cable grommet around 0:18 and brighten the shadows slightly?')
		ON CONFLICT DO NOTHING
	`, subDID, orderDID, tokotechID)

	// Order E: completed with full escrow release and ledger balance (Nusantara -> Nadia)
	orderEID := seedPilotOrder(ctx, pool, nusantaraID, creatorIDs["nadia-safira"], creatorServiceMap["nadia-safira"], creatorPackageMap["nadia-safira"], "Standard Bundle", 4500000, "IDR", 7, 2, "completed", "Aesthetic 60s Reel exploring traditional Javanese herbs and cooking presentation.")
	subEID := seedDeliverable(ctx, pool, orderEID, creatorIDs["nadia-safira"], 1, "Final 4K Food Heritage Reel", "Completed with color grade and licensed acoustic background music.", "approved")
	seedPaymentAndEscrowRelease(ctx, pool, orderEID, nusantaraID, creatorIDs["nadia-safira"], 4500000, "IDR")
	logger.Info("Seeded completed order with verified balanced ledger escrow release", "orderId", orderEID, "deliverableId", subEID)

	// Order F: disputed and resolved by admin (Southeast Escapes -> Clara)
	orderFID := seedPilotOrder(ctx, pool, clientIDs["client.travelsea@creatoros.test"], creatorIDs["clara-tan"], creatorServiceMap["clara-tan"], creatorPackageMap["clara-tan"], "Cinematic Reel", 120000, "USD", 7, 2, "disputed", "Capture sunset drone footage and private pool villa tour at Sentosa retreat.")
	seedDispute(ctx, pool, orderFID, clientIDs["client.travelsea@creatoros.test"], adminID, "Heavy thunderstorm delayed outdoor filming past the agreed deadline.")

	// Order G: completed with full escrow release (Southeast Escapes -> Reza)
	orderGID := seedPilotOrder(ctx, pool, clientIDs["client.travelsea@creatoros.test"], creatorIDs["reza-pratama"], creatorServiceMap["reza-pratama"], creatorPackageMap["reza-pratama"], "Short Feature", 3000000, "IDR", 5, 1, "completed", "Test our compact travel power station and solar fast-charging rig during a 48-hour field benchmark.")
	subGID := seedDeliverable(ctx, pool, orderGID, creatorIDs["reza-pratama"], 1, "Outdoor Field Battery Benchmark 4K", "Completed 60s Reel with power meter HUD overlays and battery decay graphs.", "approved")
	seedPaymentAndEscrowRelease(ctx, pool, orderGID, clientIDs["client.travelsea@creatoros.test"], creatorIDs["reza-pratama"], 3000000, "IDR")

	// Order H: completed with full escrow release (TokoTech -> Reza)
	orderHID := seedPilotOrder(ctx, pool, tokotechID, creatorIDs["reza-pratama"], creatorServiceMap["reza-pratama"], creatorPackageMap["reza-pratama"], "Dedicated YouTube", 7500000, "IDR", 10, 2, "completed", "In-depth studio benchmark and thermal camera dissipation test for our flagship wireless mechanical keyboard.")
	subHID := seedDeliverable(ctx, pool, orderHID, creatorIDs["reza-pratama"], 1, "Cinematic Benchmark & Keystroke ASMR", "Full 10-minute review cut with latency benchmarks and acoustic switch samples.", "approved")
	seedPaymentAndEscrowRelease(ctx, pool, orderHID, tokotechID, creatorIDs["reza-pratama"], 7500000, "IDR")
	logger.Info("Seeded completed orders for Reza Pratama with verified track record", "orderG", orderGID, "subG", subGID, "orderH", orderHID, "subH", subHID)

	// 7. Seed Direct Communication & System Notifications
	seedConversation(ctx, pool, orderCID, modestID, creatorIDs["siti-aminah"], []string{
		"Hi Siti! We have just accepted your order brief. So excited to see the pastel collection styling.",
		"Hello! Thank you, the scarf fabrics arrived safely yesterday. The silk quality is gorgeous!",
		"Wonderful! Feel free to send over the first video cut whenever you are ready.",
		"Just uploaded version 1 to the order deliverables tab. Let me know what you think!",
	})

	seedConversation(ctx, pool, orderEID, nusantaraID, creatorIDs["nadia-safira"], []string{
		"Hi Nadia, payment is held in escrow. Can we have the draft by Thursday?",
		"Hi! Yes absolutely, shooting at the pasar heritage market tomorrow morning.",
		"Deliverable approved! The color grading is fantastic. Releasing payment now.",
		"Thank you so much! Payout received in my CreatorOS wallet.",
	})

	// Seed Notifications
	for _, cid := range []string{creatorIDs["nadia-safira"], creatorIDs["reza-pratama"], creatorIDs["siti-aminah"]} {
		_, _ = pool.Exec(ctx, `
			INSERT INTO notifications (user_id, kind, title, body, action_url, is_read)
			VALUES ($1, 'order_update', 'Order Status Updated', 'Your pilot campaign order is active and progressing.', '/orders', true)
		`, cid)
	}

	// 8. Seed Announcements & Audit Logs
	_, _ = pool.Exec(ctx, `
		INSERT INTO announcements (title, body, target_role, is_active)
		VALUES
			('Welcome to CreatorOS Pilot Cohort', 'Welcome creators and brand partners to our private pilot launch. Our agency team is on-call 24/7 to support your campaigns.', 'all', true),
			('New 4K Video Deliverables Supported', 'Creators can now upload uncompressed ProRES and MP4 deliverables up to 200MB directly to order timelines.', 'creator', true)
		ON CONFLICT DO NOTHING
	`)

	_, _ = pool.Exec(ctx, `
		INSERT INTO audit_logs (actor_user_id, actor_email, action, resource_type, resource_id, details)
		VALUES
			($1, 'admin@creatoros.test', 'pilot.cohort_seeded', 'system', 'pilot-cohort-v1', '{"creators_count": 15, "clients_count": 4, "orders_count": 6}'::jsonb),
			($1, 'admin@creatoros.test', 'order.dispute_adjudicated', 'order_disputes', $2, '{"resolution": "resolved_creator_payout", "notes": "Weather delay verified via meteorological records"}'::jsonb)
	`, adminID, orderFID)

	logger.Info("CreatorOS Pilot Cohort seeding successfully finished!")
}

func seedUser(ctx context.Context, pool *pgxpool.Pool, email, name, locale, passwordHash, roleID string) string {
	var userID string
	err := pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, display_name, status, preferred_locale, email_verified_at)
		VALUES ($1, $2, $3, 'active', $4, now())
		ON CONFLICT (email) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			status = 'active',
			email_verified_at = now()
		RETURNING id
	`, email, passwordHash, name, locale).Scan(&userID)
	if err != nil {
		_ = pool.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", email).Scan(&userID)
	}

	_, _ = pool.Exec(ctx, `
		INSERT INTO user_roles (user_id, role_id)
		VALUES ($1, $2) ON CONFLICT DO NOTHING
	`, userID, roleID)

	return userID
}

func seedPilotOrder(ctx context.Context, pool *pgxpool.Pool, clientID, creatorID, serviceID, pkgID, pkgName string, priceMinor int64, currency string, delivery, revisions int, status, brief string) string {
	var orderID string
	var acceptedAt, deadlineAt any
	if status == "accepted" || status == "in_progress" || status == "completed" || status == "disputed" {
		acceptedAt = time.Now().Add(-5 * 24 * time.Hour)
		deadlineAt = time.Now().Add(time.Duration(delivery) * 24 * time.Hour)
	}

	query := `
		INSERT INTO orders (
			client_user_id, creator_user_id, service_id, package_id,
			package_name, package_description, price_minor, currency,
			delivery_days, revision_limit, brief_content, status,
			accepted_at, deadline_at
		)
		VALUES ($1, $2, $3, $4, $5, 'Pilot Package Snapshot', $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id
	`
	err := pool.QueryRow(ctx, query, clientID, creatorID, serviceID, pkgID, pkgName, priceMinor, currency, delivery, revisions, brief, status, acceptedAt, deadlineAt).Scan(&orderID)
	if err != nil {
		_ = pool.QueryRow(ctx, "SELECT id FROM orders WHERE client_user_id = $1 AND creator_user_id = $2 ORDER BY created_at DESC LIMIT 1", clientID, creatorID).Scan(&orderID)
		return orderID
	}

	// Insert brief version 1
	_, _ = pool.Exec(ctx, `
		INSERT INTO order_brief_versions (order_id, version, content, submitted_by)
		VALUES ($1, 1, $2, $3)
		ON CONFLICT (order_id, version) DO NOTHING
	`, orderID, brief, clientID)

	return orderID
}

func seedDeliverable(ctx context.Context, pool *pgxpool.Pool, orderID, creatorID string, version int, title, notes, status string) string {
	var subID string
	err := pool.QueryRow(ctx, `
		INSERT INTO order_submissions (order_id, version, creator_user_id, title, notes, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (order_id, version) DO UPDATE SET status = EXCLUDED.status
		RETURNING id
	`, orderID, version, creatorID, title, notes, status).Scan(&subID)
	if err != nil {
		_ = pool.QueryRow(ctx, "SELECT id FROM order_submissions WHERE order_id = $1 AND version = $2", orderID, version).Scan(&subID)
		return subID
	}

	_, _ = pool.Exec(ctx, `
		INSERT INTO submission_files (submission_id, file_path, file_name, mime_type, size_bytes)
		VALUES ($1, 'deliverables/pilot_cut_v1.mp4', 'pilot_cut_v1.mp4', 'video/mp4', 45280000)
		ON CONFLICT DO NOTHING
	`, subID)

	return subID
}

func seedPaymentAndEscrowRelease(ctx context.Context, pool *pgxpool.Pool, orderID, clientID, creatorID string, priceMinor int64, currency string) {
	// Payment record released
	var paymentID string
	err := pool.QueryRow(ctx, `
		INSERT INTO payments (
			order_id, client_user_id, creator_user_id, amount_minor, currency,
			status, payment_method, provider, provider_transaction_id
		)
		VALUES ($1, $2, $3, $4, $5, 'released', 'card', 'simulated', 'TX-PILOT-ESCROW-001')
		RETURNING id
	`, orderID, clientID, creatorID, priceMinor, currency).Scan(&paymentID)
	if err != nil {
		return
	}

	// Double-entry ledger:
	// 1. Initial funding: Debit client_cash, Credit platform_escrow
	// 2. Escrow release: Debit platform_escrow, Credit creator_balance (85%), Credit platform_commission (15%)
	commissionMinor := (priceMinor * 15) / 100
	creatorNetMinor := priceMinor - commissionMinor

	txID := paymentID
	_, _ = pool.Exec(ctx, `
		INSERT INTO ledger_entries (id, transaction_id, reference_type, reference_id, account_type, user_id, entry_type, amount_minor, currency, description)
		VALUES
			(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'client_cash', $3::uuid, 'debit', $4, $5, 'Client order payment'),
			(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'platform_escrow', NULL, 'credit', $4, $5, 'Escrow held by platform'),
			(gen_random_uuid(), $1::uuid, 'order_escrow', $2::uuid, 'platform_escrow', NULL, 'debit', $4, $5, 'Escrow released upon completion'),
			(gen_random_uuid(), $1::uuid, 'creator_payout', $2::uuid, 'creator_balance', $6::uuid, 'credit', $7, $5, 'Net creator payout'),
			(gen_random_uuid(), $1::uuid, 'commission', $2::uuid, 'platform_commission', NULL, 'credit', $8, $5, 'Platform service commission')
	`, txID, orderID, clientID, priceMinor, currency, creatorID, creatorNetMinor, commissionMinor)

	// Update creator wallet balance
	_, _ = pool.Exec(ctx, `
		UPDATE creator_wallets
		SET available_balance_minor = available_balance_minor + $1, updated_at = now()
		WHERE creator_user_id = $2
	`, creatorNetMinor, creatorID)
}

func seedDispute(ctx context.Context, pool *pgxpool.Pool, orderID, clientID, adminID, reason string) {
	_, _ = pool.Exec(ctx, `
		INSERT INTO order_disputes (order_id, initiator_user_id, reason, status, resolution_notes, resolved_by, resolved_at)
		VALUES ($1, $2, $3, 'resolved_creator_payout', 'Weather delays verified by agency team. Creator delivered stellar makeup shots once rain cleared.', $4, now())
		ON CONFLICT (order_id) DO NOTHING
	`, orderID, clientID, reason, adminID)
}

func seedConversation(ctx context.Context, pool *pgxpool.Pool, orderID, clientID, creatorID string, messages []string) {
	var threadID string
	err := pool.QueryRow(ctx, `
		INSERT INTO conversation_threads (order_id)
		VALUES ($1)
		ON CONFLICT (order_id) DO UPDATE SET updated_at = now()
		RETURNING id
	`, orderID).Scan(&threadID)
	if err != nil {
		_ = pool.QueryRow(ctx, "SELECT id FROM conversation_threads WHERE order_id = $1", orderID).Scan(&threadID)
	}

	_, _ = pool.Exec(ctx, `
		INSERT INTO conversation_participants (thread_id, user_id)
		VALUES ($1, $2), ($1, $3)
		ON CONFLICT DO NOTHING
	`, threadID, clientID, creatorID)

	for i, msg := range messages {
		senderID := clientID
		if i%2 == 1 {
			senderID = creatorID
		}
		_, _ = pool.Exec(ctx, `
			INSERT INTO messages (thread_id, sender_user_id, body, created_at)
			VALUES ($1, $2, $3, now() - interval '`+fmt.Sprintf("%d", (len(messages)-i)*3)+` hours')
		`, threadID, senderID, msg)
	}
}
