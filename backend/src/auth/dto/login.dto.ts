import { Matches } from 'class-validator';

export class LoginDto {
  @Matches(/^store_[a-zA-Z0-9_-]+$/, {
    message: 'storeId must match format store_<id>',
  })
  storeId!: string;
}
