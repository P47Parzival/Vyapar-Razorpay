import dotenv from 'dotenv';
import path from 'path';

const paths = [
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../../.env'),
];

for (const p of paths) {
  const result = dotenv.config({ path: p });
  if (!result.error) break;
}
