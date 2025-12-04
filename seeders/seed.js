'use strict';

const { Op } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
async up(queryInterface, Sequelize) {
    // --- Data Lengkap (DISASTER) ---
    // Karena Category ID tidak bisa langsung ditentukan, kita akan menggunakan nama Kategori (string)
    // di objek perfectBooks dan melakukan pemetaan ID di bagian 'Pemrosesan Data'.
    const perfectBooks = [
    {
        id: 1,
        title: 'Bandung Menjelang Pagi',
        original_title: 'Bandung Menjelang Pagi',
        statement_of_responsibility: 'oleh Brian Khrisna',
        series_title: 'Non-Seri',
        edition: 'Cetakan ke-1',
        publish_year: '2020',
        publish_place: 'Jakarta',
        physical_description: '250 hlm.; 20 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9786237732296',
        call_number: '813.91 BRI B',
        abstract: 'Kumpulan cerita dan refleksi tentang kota, perjalanan, dan makna kehidupan di pagi hari.',
        notes: 'Diterbitkan oleh mediakita',
        language: 'Indonesia',
        work_type: 'Kumpulan Esai',
        target_audience: 'Dewasa Muda',
        shelf_location: 'Rak A1', // REVISI: Lokasi Rak
        stock_total: 10,
        stock_available: 8,
        category: 'Kumpulan Esai', // REVISI: Kategori Genre
        image: 'Bandung_Menjelang_Pagi.jpg',
        authors: ['Brian Khrisna'],
        publishers: ['Mediakita'],
        subjects: ['Refleksi Personal', 'Urban Life', 'Kutipan'] // REVISI: Subjek Detail
    },
    {
        id: 2,
        title: 'Angsa dan Kelelawar',
        original_title: 'Hakuchō to Kōmori',
        statement_of_responsibility: 'oleh Keigo Higashino',
        series_title: 'Seri Misteri',
        edition: 'Cetakan ke-1',
        publish_year: '2022',
        publish_place: 'Jakarta',
        physical_description: '520 hlm.; 21 cm',
        content_type: 'Teks',
        media_type: 'Hardcover', // REVISI: Hardcover
        carrier_type: 'Buku',
        isbn: '9786237812165',
        call_number: '895.63 HIG A',
        abstract: 'Kisah misteri tentang pembalasan dendam yang berlatar belakang dua kasus pembunuhan yang berbeda.',
        notes: 'Diterbitkan oleh Gramedia Pustaka Utama',
        language: 'Indonesia (terjemahan)',
        work_type: 'Novel',
        target_audience: 'Dewasa',
        shelf_location: 'Rak B2', // REVISI: Lokasi Rak
        stock_total: 15,
        stock_available: 10,
        category: 'Thriller', // REVISI: Kategori Genre
        image: 'Angsa_dan_Kelelawar.jpg',
        authors: ['Keigo Higashino'],
        publishers: ['Gramedia Pustaka Utama'],
        subjects: ['Misteri', 'Kejahatan', 'Fiksi Jepang'] // REVISI: Subjek Detail
    },
    {
        id: 3,
        title: 'Animal Farm',
        original_title: 'Animal Farm: A Fairy Story',
        statement_of_responsibility: 'by George Orwell',
        series_title: 'Non-Seri',
        edition: 'Edisi Khusus',
        publish_year: '1945',
        publish_place: 'London',
        physical_description: '150 hlm.; 18 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9780451526342',
        call_number: '823.91 ORW A',
        abstract: 'Sebuah novel alegoris tentang sekelompok hewan ternak yang memberontak melawan petani manusia mereka.',
        notes: 'Sastra klasik, alegori politik.',
        language: 'Inggris',
        work_type: 'Novel',
        target_audience: 'Umum',
        shelf_location: 'Rak B1', // REVISI: Lokasi Rak
        stock_total: 20,
        stock_available: 18,
        category: 'Sastra Klasik', // REVISI: Kategori Genre
        image: 'Animal_Farm.jpg',
        authors: ['George Orwell'],
        publishers: ['Penguin Books'],
        subjects: ['Alegori', 'Fiksi Politik', 'Sastra Inggris'] // REVISI: Subjek Detail
    },
    {
        id: 4,
        title: 'Atomic Habits',
        original_title: 'Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones',
        statement_of_responsibility: 'by James Clear',
        series_title: 'Non-Seri',
        edition: 'Edisi Internasional',
        publish_year: '2018',
        publish_place: 'New York',
        physical_description: '320 hlm.; 23 cm',
        content_type: 'Teks',
        media_type: 'Hardcover', // REVISI: Hardcover
        carrier_type: 'Buku',
        isbn: '9780735211292',
        call_number: '158.1 CLE A',
        abstract: 'Panduan praktis berbasis sains tentang cara membangun kebiasaan baik dan menghilangkan kebiasaan buruk.',
        notes: 'Buku terlaris tentang pengembangan diri.',
        language: 'Inggris',
        work_type: 'Buku Panduan',
        target_audience: 'Umum',
        shelf_location: 'Rak C3', // REVISI: Lokasi Rak
        stock_total: 30,
        stock_available: 25,
        category: 'Pengembangan Diri', // REVISI: Kategori Genre
        image: 'Atomic_Habit.jpg',
        authors: ['James Clear'],
        publishers: ['Avery Publishing Group'],
        subjects: ['Kebiasaan', 'Produktivitas', 'Psikologi Terapan'] // REVISI: Subjek Detail
    },
    {
        id: 5,
        title: 'Berani Tidak Disukai',
        original_title: '嫌われる勇気 : 自己啓発の源流「アドラー」の教え',
        statement_of_responsibility: 'oleh Ichiro Kishimi Dan Fumitake Koga',
        series_title: 'Non-Seri',
        edition: 'Cetakan ke-5',
        publish_year: '2019',
        publish_place: 'Jakarta',
        physical_description: '350 hlm.; 21 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9786020332611',
        call_number: '155.2 KIS B',
        abstract: 'Dialog filosofis yang membahas pandangan Alfred Adler tentang kebahagiaan dan kebebasan.',
        notes: 'Terjemahan dari bahasa Jepang.',
        language: 'Indonesia (terjemahan)',
        work_type: 'Dialog Filosofis',
        target_audience: 'Umum',
        shelf_location: 'Rak C2', // REVISI: Lokasi Rak
        stock_total: 25,
        stock_available: 20,
        category: 'Filsafat', // REVISI: Kategori Genre
        image: 'Berani_Tidak_Disukai.jpg',
        authors: ['Ichiro Kishimi', 'Fumitake Koga'],
        publishers: ['Gramedia Pustaka Utama'],
        subjects: ['Filsafat Adlerian', 'Psikologi', 'Eksistensialisme'] // REVISI: Subjek Detail
    },
    {
        id: 6,
        title: 'Berani Bahagia',
        original_title: 'しあわせになる勇気 : 自己啓発の源流「アドラー」の教えII',
        statement_of_responsibility: 'oleh Ichiro Kishimi Dan Fumitake Koga',
        series_title: 'Berani Tidak Disukai #2',
        edition: 'Cetakan ke-1',
        publish_year: '2020',
        publish_place: 'Jakarta',
        physical_description: '380 hlm.; 21 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9786020641198',
        call_number: '155.2 KIS B2',
        abstract: 'Kelanjutan dari pembahasan psikologi Adler, berfokus pada hubungan interpersonal dan kebahagiaan sejati.',
        notes: 'Sekuel dari Berani Tidak Disukai.',
        language: 'Indonesia (terjemahan)',
        work_type: 'Dialog Filosofis',
        target_audience: 'Umum',
        shelf_location: 'Rak C2', // REVISI: Lokasi Rak
        stock_total: 18,
        stock_available: 15,
        category: 'Filsafat', // REVISI: Kategori Genre
        image: 'Berani_Bahagia.jpg',
        authors: ['Ichiro Kishimi', 'Fumitake Koga'],
        publishers: ['Gramedia Pustaka Utama'],
        subjects: ['Filsafat Adlerian', 'Kebahagiaan', 'Hubungan Interpersonal'] // REVISI: Subjek Detail
    },
    {
        id: 7,
        title: 'Keajaiban Toko Kelontong Namiya',
        original_title: 'ナミヤ雑貨店の奇蹟',
        statement_of_responsibility: 'oleh Keigo Higashino',
        series_title: 'Non-Seri',
        edition: 'Cetakan ke-8',
        publish_year: '2017',
        publish_place: 'Jakarta',
        physical_description: '450 hlm.; 20 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9786024240746',
        call_number: '895.63 HIG K',
        abstract: 'Sebuah cerita fiksi fantasi yang menggabungkan elemen misteri dan perjalanan waktu melalui surat-surat.',
        notes: 'Pemenang Chūōkōron Award.',
        language: 'Indonesia (terjemahan)',
        work_type: 'Novel',
        target_audience: 'Umum',
        shelf_location: 'Rak A3', // REVISI: Lokasi Rak
        stock_total: 22,
        stock_available: 19,
        category: 'Fantasi', // REVISI: Kategori Genre
        image: 'Keajaiban_Toko_Kelontong_Namiya.jpg',
        authors: ['Keigo Higashino'],
        publishers: ['Gramedia Pustaka Utama'],
        subjects: ['Misteri', 'Fantasi', 'Fiksi Jepang'] // REVISI: Subjek Detail
    },
    {
        id: 8,
        title: 'Salvation of a Saint',
        original_title: '聖女の救済',
        statement_of_responsibility: 'by Keigo Higashino',
        series_title: 'Detective Galileo #6',
        edition: 'First English Edition',
        publish_year: '2012',
        publish_place: 'New York',
        physical_description: '352 p.; 20 cm',
        content_type: 'Teks',
        media_type: 'E-book', // REVISI: E-book (Contoh)
        carrier_type: 'Digital',
        isbn: '9780345803403',
        call_number: '895.63 HIG S',
        abstract: 'Kasus pembunuhan yang melibatkan racun dan alibi yang sempurna, diselidiki oleh Detective Galileo.',
        notes: 'Bagian dari seri Detective Galileo.',
        language: 'Inggris',
        work_type: 'Novel',
        target_audience: 'Dewasa',
        shelf_location: 'Digital B2', // REVISI: Lokasi Rak (Digital)
        stock_total: 12,
        stock_available: 7,
        category: 'Thriller', // REVISI: Kategori Genre
        image: 'Salvation_of_a_Saint.jpg',
        authors: ['Keigo Higashino'],
        publishers: ['Minotaur Books'],
        subjects: ['Misteri', 'Fiksi Kejahatan', 'Detective Galileo'] // REVISI: Subjek Detail
    },
    {
        id: 9,
        title: 'Devotion of Suspect X',
        original_title: '容疑者Xの献身',
        statement_of_responsibility: 'by Keigo Higashino',
        series_title: 'Detective Galileo #3',
        edition: 'First English Edition',
        publish_year: '2005',
        publish_place: 'Tokyo',
        physical_description: '330 p.; 20 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9781934287515',
        call_number: '895.63 HIG D',
        abstract: 'Seorang guru matematika menciptakan alibi yang sangat cerdik untuk tetangganya yang terlibat pembunuhan.',
        notes: 'Pemenang Naoki Prize dan Honkaku Mystery Award.',
        language: 'Inggris',
        work_type: 'Novel',
        target_audience: 'Dewasa',
        shelf_location: 'Rak B2', // REVISI: Lokasi Rak
        stock_total: 17,
        stock_available: 12,
        category: 'Thriller', // REVISI: Kategori Genre
        image: 'Devotion_of_Suspect_X.jpg',
        authors: ['Keigo Higashino'],
        publishers: ['Kottan Publishing'],
        subjects: ['Misteri', 'Fiksi Kejahatan', 'Matematika'] // REVISI: Subjek Detail
    },
    {
        id: 10,
        title: 'A Midsummer`s Equation',
        original_title: '真夏の方程式',
        statement_of_responsibility: 'by Keigo Higashino',
        series_title: 'Detective Galileo #5',
        edition: 'First English Edition',
        publish_year: '2013',
        publish_place: 'New York',
        physical_description: '384 p.; 20 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9781616952818',
        call_number: '895.63 HIG M',
        abstract: 'Galileo mengunjungi kota pantai untuk seminar, namun ia malah terlibat dalam kasus kematian misterius.',
        notes: 'Berlatar di sebuah kota tepi laut yang indah.',
        language: 'Inggris',
        work_type: 'Novel',
        target_audience: 'Dewasa',
        shelf_location: 'Rak B2', // REVISI: Lokasi Rak
        stock_total: 9,
        stock_available: 5,
        category: 'Thriller', // REVISI: Kategori Genre
        image: 'A_Midsummer_s_Equation.jpg',
        authors: ['Keigo Higashino'],
        publishers: ['Minotaur Books'],
        subjects: ['Misteri', 'Fiksi Kejahatan', 'Detective Galileo'] // REVISI: Subjek Detail
    },
    {
        id: 11,
        title: 'Silent Parade',
        original_title: '沈黙のパレード',
        statement_of_responsibility: 'by Keigo Higashino',
        series_title: 'Detective Galileo #9',
        edition: 'First English Edition',
        publish_year: '2021',
        publish_place: 'New York',
        physical_description: '375 p.; 20 cm',
        content_type: 'Teks',
        media_type: 'Hardcover', // REVISI: Hardcover
        carrier_type: 'Buku',
        isbn: '9781250265147',
        call_number: '895.63 HIG P',
        abstract: 'Ketika seorang tersangka pembunuhan dibebaskan dan kemudian meninggal, Galileo harus mencari kebenaran.',
        notes: 'Novel terbaru dalam seri Detective Galileo.',
        language: 'Inggris',
        work_type: 'Novel',
        target_audience: 'Dewasa',
        shelf_location: 'Rak B2', // REVISI: Lokasi Rak
        stock_total: 14,
        stock_available: 10,
        category: 'Thriller', // REVISI: Kategori Genre
        image: 'Silent_Parade.jpg',
        authors: ['Keigo Higashino'],
        publishers: ['Minotaur Books'],
        subjects: ['Misteri', 'Fiksi Kejahatan', 'Keadilan'] // REVISI: Subjek Detail
    },
    {
        id: 12,
        title: 'The Tokyo Zodiac Murders',
        original_title: '占星術殺人事件',
        statement_of_responsibility: 'by Soji Shimada',
        series_title: 'Kiyoshi Mitarai #1',
        edition: 'First English Edition',
        publish_year: '1981',
        publish_place: 'Tokyo',
        physical_description: '300 p.; 19 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9780857301017',
        call_number: '895.63 SHI T',
        abstract: 'Pembunuhan berantai yang terinspirasi astrologi, dipecahkan oleh detektif Kiyoshi Mitarai.',
        notes: 'Klasik Honkaku Mystery.',
        language: 'Inggris',
        work_type: 'Novel',
        target_audience: 'Dewasa',
        shelf_location: 'Rak B1', // REVISI: Lokasi Rak
        stock_total: 11,
        stock_available: 6,
        category: 'Misteri', // REVISI: Kategori Genre
        image: 'THE_TOKYO_ZODIAK_MURDER.jpg',
        authors: ['Soji Shimada'],
        publishers: ['Pushkin Press'],
        subjects: ['Misteri Jepang', 'Pembunuhan Berantai', 'Astrologi'] // REVISI: Subjek Detail
    },
    {
        id: 13,
        title: 'Seporsi Mie Ayam Sebelum Mati',
        original_title: 'Seporsi Mie Ayam Sebelum Mati',
        statement_of_responsibility: 'oleh Brian Khrisna',
        series_title: 'Non-Seri',
        edition: 'Cetakan ke-1',
        publish_year: '2022',
        publish_place: 'Jakarta',
        physical_description: '280 hlm.; 20 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9786237732951',
        call_number: '813.91 BRI S',
        abstract: 'Kumpulan cerita tentang momen-momen intim dalam hidup yang seringkali diabaikan.',
        notes: 'Tema tentang kenangan dan makanan.',
        language: 'Indonesia',
        work_type: 'Kumpulan Cerita',
        target_audience: 'Dewasa Muda',
        shelf_location: 'Rak A1', // REVISI: Lokasi Rak
        stock_total: 10,
        stock_available: 5,
        category: 'Fiksi Populer', // REVISI: Kategori Genre
        image: 'Seporsi_Mie_Ayam_Sebelum_Mati.jpg',
        authors: ['Brian Khrisna'],
        publishers: ['Mediakita'],
        subjects: ['Fiksi Indonesia', 'Kenangan', 'Kuliner Fiksi'] // REVISI: Subjek Detail
    },
    {
        id: 14,
        title: 'Teka Teki Rumah Aneh',
        original_title: '変な家',
        statement_of_responsibility: 'oleh Uketsu',
        series_title: 'Non-Seri',
        edition: 'Cetakan ke-1',
        publish_year: '2023',
        publish_place: 'Jakarta',
        physical_description: '200 hlm.; 19 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9786230309608',
        call_number: '895.63 UKE T',
        abstract: 'Novel horor-misteri yang bermula dari denah rumah aneh dengan tata letak yang tidak masuk akal.',
        notes: 'Viral di media sosial Jepang.',
        language: 'Indonesia (terjemahan)',
        work_type: 'Novel',
        target_audience: 'Remaja/Dewasa',
        shelf_location: 'Rak B3', // REVISI: Lokasi Rak
        stock_total: 13,
        stock_available: 9,
        category: 'Horor', // REVISI: Kategori Genre
        image: 'Teka_Teki_Rumah_Aneh.jpg',
        authors: ['Uketsu'],
        publishers: ['Penerbit Haru'],
        subjects: ['Horor', 'Misteri', 'Arsitektur Fiksi'] // REVISI: Subjek Detail
    },
    {
        id: 15,
        title: 'Makanya, Mikir!',
        original_title: 'Makanya, Mikir!',
        statement_of_responsibility: 'oleh Abigail Limuria & Cania Citta',
        series_title: 'Non-Seri',
        edition: 'Cetakan ke-1',
        publish_year: '2023',
        publish_place: 'Jakarta',
        physical_description: '240 hlm.; 20 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9786020668980',
        call_number: '302.2 ABI M',
        abstract: 'Buku yang membahas tentang pentingnya berpikir kritis dan bernalar dalam kehidupan sehari-hari.',
        notes: 'Mengajarkan kemampuan berpikir kritis.',
        language: 'Indonesia',
        work_type: 'Nonfiksi',
        target_audience: 'Umum',
        shelf_location: 'Rak C1', // REVISI: Lokasi Rak
        stock_total: 16,
        stock_available: 14,
        category: 'Edukasi', // REVISI: Kategori Genre
        image: 'Makanya_Mikir_.jpg',
        authors: ['Abigail Limuria', 'Cania Citta'],
        publishers: ['Gramedia Pustaka Utama'],
        subjects: ['Berpikir Kritis', 'Logika', 'Retorika'] // REVISI: Subjek Detail
    },
    {
        id: 16,
        title: 'The Psychology of Money',
        original_title: 'The Psychology of Money: Timeless lessons on wealth, greed, and happiness',
        statement_of_responsibility: 'by Morgan Housel',
        series_title: 'Non-Seri',
        edition: 'International Edition',
        publish_year: '2020',
        publish_place: 'New York',
        physical_description: '256 p.; 22 cm',
        content_type: 'Teks',
        media_type: 'Hardcover', // REVISI: Hardcover
        carrier_type: 'Buku',
        isbn: '9780857197689',
        call_number: '332.024 HOU P',
        abstract: 'Buku yang mengeksplorasi bagaimana hubungan psikologis kita memengaruhi keputusan finansial.',
        notes: 'Wajib baca untuk literasi finansial.',
        language: 'Inggris',
        work_type: 'Nonfiksi',
        target_audience: 'Umum',
        shelf_location: 'Rak C3', // REVISI: Lokasi Rak
        stock_total: 28,
        stock_available: 23,
        category: 'Finansial', // REVISI: Kategori Genre
        image: 'The_Psychology_of_Money.jpg',
        authors: ['Morgan Housel'],
        publishers: ['Harriman House'],
        subjects: ['Investasi', 'Perilaku Finansial', 'Psikologi'] // REVISI: Subjek Detail
    },
    {
        id: 17,
        title: 'Dompet Ayah Sepatu Ibu',
        original_title: 'Dompet Ayah Sepatu Ibu',
        statement_of_responsibility: 'oleh J.S. Khairen',
        series_title: 'Non-Seri',
        edition: 'Cetakan ke-1',
        publish_year: '2022',
        publish_place: 'Jakarta',
        physical_description: '300 hlm.; 20 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9786020665316',
        call_number: '813.91 KHA D',
        abstract: 'Novel yang menceritakan kisah tentang perjuangan dan cinta orang tua dari sudut pandang anak.',
        notes: 'Mengandung pesan moral yang kuat.',
        language: 'Indonesia',
        work_type: 'Novel',
        target_audience: 'Dewasa Muda',
        shelf_location: 'Rak A2', // REVISI: Lokasi Rak
        stock_total: 18,
        stock_available: 15,
        category: 'Fiksi Populer', // REVISI: Kategori Genre
        image: 'Dompet_Ayah_Sepatu_Ibu.jpg',
        authors: ['J.S. Khairen'],
        publishers: ['Gramedia Pustaka Utama'],
        subjects: ['Fiksi Indonesia', 'Keluarga', 'Inspirasi'] // REVISI: Subjek Detail
    },
    {
        id: 18,
        title: 'Laut Bercerita',
        original_title: 'Laut Bercerita',
        statement_of_responsibility: 'oleh Leila S. Chudori',
        series_title: 'Non-Seri',
        edition: 'Cetakan ke-3',
        publish_year: '2017',
        publish_place: 'Jakarta',
        physical_description: '379 hlm.; 21 cm',
        content_type: 'Teks',
        media_type: 'Hardcover', // REVISI: Hardcover
        carrier_type: 'Buku',
        isbn: '9786020356501',
        call_number: '813.54 CHU L',
        abstract: 'Novel fiksi sejarah yang berlatar belakang peristiwa penghilangan paksa aktivis tahun 1998.',
        notes: 'Pemenang Sayembara Novel Dewan Kesenian Jakarta.',
        language: 'Indonesia',
        work_type: 'Novel',
        target_audience: 'Dewasa',
        shelf_location: 'Rak A2', // REVISI: Lokasi Rak
        stock_total: 20,
        stock_available: 16,
        category: 'Fiksi Sejarah', // REVISI: Kategori Genre
        image: 'Laut-Bercerita.jpg',
        authors: ['Leila S. Chudori'],
        publishers: ['Kepustakaan Populer Gramedia'],
        subjects: ['Sejarah 1998', 'Politik', 'Aktivisme'] // REVISI: Subjek Detail
    },
    {
        id: 19,
        title: 'Hujan',
        original_title: 'Hujan',
        statement_of_responsibility: 'oleh Tere Liye',
        series_title: 'Non-Seri',
        edition: 'Cetakan ke-10',
        publish_year: '2016',
        publish_place: 'Jakarta',
        physical_description: '320 hlm.; 20 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9786020324784',
        call_number: '813.91 LIE H',
        abstract: 'Kisah romantis futuristik tentang persahabatan, cinta, dan pengorbanan di tengah bencana alam.',
        notes: 'Mengandung unsur *young adult*.',
        language: 'Indonesia',
        work_type: 'Novel',
        target_audience: 'Remaja/Dewasa Muda',
        shelf_location: 'Rak A3', // REVISI: Lokasi Rak
        stock_total: 25,
        stock_available: 21,
        category: 'Fiksi Ilmiah', // REVISI: Kategori Genre
        image: 'Hujan.jpg',
        authors: ['Tere Liye'],
        publishers: ['Gramedia Pustaka Utama'],
        subjects: ['Romance', 'Fiksi Ilmiah', 'Bencana Alam'] // REVISI: Subjek Detail
    },
    {
        id: 20,
        title: 'The Alchemist',
        original_title: 'O Alquimista',
        statement_of_responsibility: 'by Paulo Coelho',
        series_title: 'Non-Seri',
        edition: '25th Anniversary Edition',
        publish_year: '1988',
        publish_place: 'Rio de Janeiro',
        physical_description: '192 p.; 20 cm',
        content_type: 'Teks',
        media_type: 'Softcover', // REVISI: Softcover
        carrier_type: 'Buku',
        isbn: '9780061122415',
        call_number: '869.3 COE A',
        abstract: 'Kisah alegoris tentang seorang gembala muda yang melakukan perjalanan mencari harta karun.',
        notes: 'Sangat laris, diterjemahkan ke banyak bahasa.',
        language: 'Inggris',
        work_type: 'Novel',
        target_audience: 'Umum',
        shelf_location: 'Rak C1', // REVISI: Lokasi Rak
        stock_total: 30,
        stock_available: 28,
        category: 'Alegori', // REVISI: Kategori Genre
        image: 'The_Alchemist.jpg',
        authors: ['Paulo Coelho'],
        publishers: ['HarperOne'],
        subjects: ['Alegori', 'Inspirasi', 'Petualangan'] // REVISI: Subjek Detail
    },
    ];

    // --- Pemrosesan Data untuk Seeder ---

    // 1. Data Category
    // Mengambil nama kategori unik dari data yang sudah diperbarui
    const uniqueCategories = Array.from(new Set(perfectBooks.map(b => b.category)));
    const categories = uniqueCategories.map((name, index) => ({
    id: index + 1,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    }));
    await queryInterface.bulkInsert('Categories', categories, {});
    const categoryMap = categories.reduce((map, cat) => {
    map[cat.name] = cat.id;
    return map;
    }, {});

    // 2. Data Author
    let allAuthorNames = [];
    perfectBooks.forEach(b => {
    b.authors.forEach(a => allAuthorNames.push(a));
    });
    allAuthorNames = Array.from(new Set(allAuthorNames));

    const authors = allAuthorNames.map((name, index) => ({
    id: index + 1,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    }));
    await queryInterface.bulkInsert('Authors', authors, {});
    const authorMap = authors.reduce((map, author) => {
    map[author.name] = author.id;
    return map;
    }, {});

    // 3. Data Publisher
    let allPublisherNames = [];
    perfectBooks.forEach(b => {
    b.publishers.forEach(p => allPublisherNames.push(p));
    });
    allPublisherNames = Array.from(new Set(allPublisherNames));

    const publishers = allPublisherNames.map((name, index) => ({
    id: index + 1,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    }));
    await queryInterface.bulkInsert('Publishers', publishers, {});
    const publisherMap = publishers.reduce((map, publisher) => {
    map[publisher.name] = publisher.id;
    return map;
    }, {});

    // 4. Data Subject
    let allSubjectNames = [];
    perfectBooks.forEach(b => {
    b.subjects.forEach(s => allSubjectNames.push(s));
    });
    allSubjectNames = Array.from(new Set(allSubjectNames));

    const subjects = allSubjectNames.map((name, index) => ({
    id: index + 1,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    }));
    await queryInterface.bulkInsert('Subjects', subjects, {});
    const subjectMap = subjects.reduce((map, subject) => {
    map[subject.name] = subject.id;
    return map;
    }, {});


    // 5. Data Book
    const books = perfectBooks.map(b => ({
    id: b.id,
    title: b.title,
    original_title: b.original_title,
    statement_of_responsibility: b.statement_of_responsibility,
    series_title: b.series_title,
    edition: b.edition,
    publish_year: b.publish_year,
    publish_place: b.publish_place,
    physical_description: b.physical_description,
    content_type: b.content_type,
    media_type: b.media_type, // Sudah diperbarui
    carrier_type: b.carrier_type,
    isbn: b.isbn,
    call_number: b.call_number,
    abstract: b.abstract,
    notes: b.notes,
    language: b.language,
    work_type: b.work_type,
    target_audience: b.target_audience,
    shelf_location: b.shelf_location, // Sudah diperbarui
    stock_total: b.stock_total,
    stock_available: b.stock_available,
    category_id: categoryMap[b.category], // Menggunakan map dari nama kategori ke ID
    image: b.image,
    createdAt: new Date(),
    updatedAt: new Date(),
    }));
    await queryInterface.bulkInsert('Books', books, {});


    // 6. Data Junction Tables (BookAuthor, BookPublisher, BookSubject)
    const bookAuthors = [];
    const bookPublishers = [];
    const bookSubjects = [];

    perfectBooks.forEach(book => {
    // BookAuthor
    book.authors.forEach(authorName => {
        bookAuthors.push({
        book_id: book.id,
        author_id: authorMap[authorName],
        role: 'Pengarang', // Role diisi default 'Pengarang'
        createdAt: new Date(),
        updatedAt: new Date(),
        });
    });

    // BookPublisher
    book.publishers.forEach(publisherName => {
        bookPublishers.push({
        book_id: book.id,
        publisher_id: publisherMap[publisherName],
        createdAt: new Date(),
        updatedAt: new Date(),
        });
    });

    // BookSubject
    book.subjects.forEach(subjectName => {
        bookSubjects.push({
        book_id: book.id,
        subject_id: subjectMap[subjectName],
        createdAt: new Date(),
        updatedAt: new Date(),
        });
    });
    });

    await queryInterface.bulkInsert('BookAuthors', bookAuthors, {});
    await queryInterface.bulkInsert('BookPublishers', bookPublishers, {});
    await queryInterface.bulkInsert('BookSubjects', bookSubjects, {});
},

async down(queryInterface, Sequelize) {
    // Hapus data dari tabel junction terlebih dahulu
    await queryInterface.bulkDelete('BookSubjects', null, {});
    await queryInterface.bulkDelete('BookPublishers', null, {});
    await queryInterface.bulkDelete('BookAuthors', null, {});

    // Hapus data dari tabel utama
    await queryInterface.bulkDelete('Books', null, {});
    await queryInterface.bulkDelete('Subjects', null, {});
    await queryInterface.bulkDelete('Publishers', null, {});
    await queryInterface.bulkDelete('Authors', null, {});
    await queryInterface.bulkDelete('Categories', null, {});
}
};