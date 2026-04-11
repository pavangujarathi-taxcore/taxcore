# 🏦 TaxCore - ITR Workflow & Status Tracker

A comprehensive Income Tax Return (ITR) workflow management system with real-time synchronization across devices.

## ✨ Features

- 📊 **Dashboard** - Real-time metrics and alerts
- 👥 **Client Management** - Complete client master with PAN details
- 📄 **Document Tracking** - Inward/Outward document management
- 🔄 **Work Processing** - ITR filing workflow & status tracking
- 💰 **Billing** - Invoice generation and payment tracking
- 📤 **Export** - Export data to CSV format
- 📥 **Import** - Bulk import clients from Excel
- 👤 **User Management** - Role-based access (Super Admin, Owner, Staff)
- 📋 **Audit Log** - Complete activity tracking
- ⚙️ **Settings** - WhatsApp integration and notifications

## 🚀 Live Demo

Visit: [Your Vercel URL will be here]

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Internet Computer Protocol (ICP) Motoko Canister
- **Storage**: ICP Canister (Blockchain-based)
- **Authentication**: Internet Identity
- **Real-time Sync**: 2-second polling with retry mechanism

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/taxcore.git

# Navigate to frontend
cd taxcore/src/frontend

# Install dependencies
yarn install

# Start development server
yarn dev
```

## 🌐 Deployment

This app is ready to deploy on:
- ✅ Vercel (Recommended)
- ✅ Netlify
- ✅ Cloudflare Pages
- ✅ GitHub Pages

### Deploy on Vercel (1-Click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/taxcore)

## 🔐 Security

- Password hashing with bcryptjs
- Role-based access control
- Audit logging for all operations
- Secure data storage on blockchain

## 🆕 Recent Updates

- ✅ Real-time sync reduced to 2 seconds
- ✅ Fixed: Deleted clients reappear bug
- ✅ Added: Excel import feature with validation
- ✅ Enhanced: Exponential backoff for sync retries
- ✅ Added: Persistent sync queue for offline support

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues or questions, please open an issue on GitHub.

---

**Made with ❤️ for efficient ITR workflow management**
