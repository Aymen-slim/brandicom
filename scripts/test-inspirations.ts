import {
  detectVideoPlatform,
  detectVideoFormat,
  cleanVideoUrl,
  extractClientInspirations,
  packClientInspirations,
} from '../src/lib/clientInspirations';
import { extractClientMonthlyGoals } from '../src/lib/clientGoals';
import { InspirationIdea } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('--- 1. Testing Video Platform Detection ---');
  assert(
    detectVideoPlatform('https://www.instagram.com/reel/C-XYZ123/?igsh=abc') === 'instagram',
    'Detects Instagram from reel URL'
  );
  assert(
    detectVideoPlatform('https://instagr.am/p/C-XYZ123/') === 'instagram',
    'Detects Instagram from short domain instagr.am'
  );
  assert(
    detectVideoPlatform('https://www.tiktok.com/@agency/video/7391234567890123456') === 'tiktok',
    'Detects TikTok from video URL'
  );
  assert(
    detectVideoPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ') === 'youtube',
    'Detects YouTube from shorts URL'
  );
  assert(
    detectVideoPlatform('https://youtu.be/dQw4w9WgXcQ') === 'youtube',
    'Detects YouTube from youtu.be'
  );
  assert(
    detectVideoPlatform('https://www.facebook.com/reel/123456789') === 'facebook',
    'Detects Facebook from reel URL'
  );
  assert(
    detectVideoPlatform('https://vimeo.com/123456') === 'other',
    'Detects other platforms as other'
  );

  console.log('\n--- 2. Testing Video Format Detection ---');
  assert(
    detectVideoFormat('https://www.instagram.com/reel/C-XYZ123/') === 'reel',
    'Instagram reel detects as reel'
  );
  assert(
    detectVideoFormat('https://www.tiktok.com/@creator/video/123') === 'reel',
    'TikTok video detects as reel'
  );
  assert(
    detectVideoFormat('https://www.youtube.com/shorts/xyz') === 'reel',
    'YouTube Shorts detects as reel'
  );
  assert(
    detectVideoFormat('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'video',
    'YouTube standard video detects as video'
  );

  console.log('\n--- 3. Testing URL Cleaner ---');
  const dirtyIg = 'https://www.instagram.com/reel/C-XYZ123/?igsh=123456&utm_source=ig_web_copy_link';
  const cleanIg = cleanVideoUrl(dirtyIg);
  assert(
    !cleanIg.includes('igsh') && !cleanIg.includes('utm_source'),
    'Strips social media tracking parameters from Instagram URL'
  );
  assert(
    cleanIg === 'https://www.instagram.com/reel/C-XYZ123/',
    'Normalized URL is clean and accurate'
  );

  console.log('\n--- 4. Testing Inspiration Tag Packing & Extraction ---');
  const existingTags = [
    'goal:reels:12',
    'goal:posts:4',
    'baseline:instagram:15400',
    'vip_client',
  ];

  const ideasToSave: InspirationIdea[] = [
    {
      id: 'idea-1',
      title: 'POV unboxing with fast rhythmic cut',
      url: 'https://www.instagram.com/reel/C-XYZ123/',
      platform: 'instagram',
      format: 'reel',
      notes: 'Use the viral bass-drop transition sound',
      createdAt: '2026-09-10T10:00:00.000Z',
      createdBy: 'Aymen',
    },
    {
      id: 'idea-2',
      title: 'Behind the scenes coffee brewing aesthetic',
      url: 'https://www.tiktok.com/@barista/video/739000111222',
      platform: 'tiktok',
      format: 'reel',
      notes: 'Warm lighting and close-up macro shots',
      createdAt: '2026-09-10T12:00:00.000Z',
      createdBy: 'Sarah',
    },
  ];

  const packedTags = packClientInspirations(existingTags, ideasToSave);
  assert(packedTags.length === existingTags.length + 2, 'Packs correct number of tags');
  assert(
    packedTags.includes('goal:reels:12') && packedTags.includes('vip_client'),
    'Preserves existing client tags and monthly goals'
  );

  // Verify monthly goals extraction is unaffected
  const goals = extractClientMonthlyGoals(packedTags);
  assert(goals.reels === 12 && goals.posts === 4, 'Monthly content goals intact after packing inspirations');

  // Extract inspirations back
  const extracted = extractClientInspirations(packedTags);
  assert(extracted.length === 2, 'Extracts exactly 2 inspiration ideas');
  assert(
    extracted[0].id === 'idea-2',
    'Sorts newest idea first (idea-2 at 12:00 comes before idea-1 at 10:00)'
  );
  assert(
    extracted[0].title === 'Behind the scenes coffee brewing aesthetic',
    'Extracted title matches'
  );
  assert(
    extracted[0].platform === 'tiktok',
    'Extracted platform matches'
  );
  assert(
    extracted[0].notes === 'Warm lighting and close-up macro shots',
    'Extracted notes match'
  );
  assert(
    extracted[1].url === 'https://www.instagram.com/reel/C-XYZ123/',
    'Extracted URL matches'
  );

  console.log('\n--- 5. Testing Idea Removal / Update ---');
  // Remove idea-1
  const remainingIdeas = extracted.filter((item) => item.id !== 'idea-1');
  const repackedTags = packClientInspirations(packedTags, remainingIdeas);
  const reExtracted = extractClientInspirations(repackedTags);
  assert(reExtracted.length === 1, 'Correctly deletes an inspiration idea');
  assert(reExtracted[0].id === 'idea-2', 'Remaining idea is preserved');

  console.log('\n--- 6. Testing Dev Server HTTP Response ---');
  try {
    const res = await fetch('http://localhost:3000/login');
    assert(res.status === 200, `Dev server /login returned HTTP ${res.status}`);
  } catch (err: any) {
    console.error('HTTP test error:', err.message);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Tests Complete: ${passed} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
