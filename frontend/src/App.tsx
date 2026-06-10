import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Chat from "./pages/Chat";
import Collections from "./pages/Collections";
import Upload from "./pages/Upload";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Chat />} />
          <Route path="collections" element={<Collections />} />
          <Route path="upload" element={<Upload />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
