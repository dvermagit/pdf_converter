import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from './components/ui/provider';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { PdfToWord } from './pages/PdfToWord';
import { PdfToJpg } from './pages/PdfToJpg';
import { WordToPdf } from './pages/WordToPdf';
import { PdfWatermark } from './pages/PdfWatermark';
import { PdfMerge } from './pages/PdfMerge';
import { PdfSplit } from './pages/PdfSplit';
import { PdfSign } from './pages/PdfSign';
import { Box } from '@chakra-ui/react';

function App() {
  return (
    <Provider>
      <BrowserRouter>
        <Box minH="100vh" bg="gray.50">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pdf-to-word" element={<PdfToWord />} />
            <Route path="/pdf-to-jpg" element={<PdfToJpg />} />
            <Route path="/word-to-pdf" element={<WordToPdf />} />
            <Route path="/pdf-watermark" element={<PdfWatermark />} />
            <Route path="/pdf-merge" element={<PdfMerge />} />
            <Route path="/pdf-split" element={<PdfSplit />} />
            <Route path="/pdf-sign" element={<PdfSign />} />
          </Routes>
        </Box>
      </BrowserRouter>
    </Provider>
  );
}

export default App;
