import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>
  ) {}

  private countryToCurrencyMap: Record<string, string> = {
    AF: 'AFN', AL: 'ALL', DZ: 'DZD', AS: 'USD', AD: 'EUR', AO: 'AOA', AI: 'XCD', AG: 'XCD', AR: 'ARS',
    AM: 'AMD', AW: 'AWG', AU: 'AUD', AT: 'EUR', AZ: 'AZN', BS: 'BSD', BH: 'BHD', BD: 'BDT', BB: 'BBD',
    BY: 'BYN', BE: 'EUR', BZ: 'BZD', BJ: 'XOF', BM: 'BMD', BT: 'BTN', BO: 'BOB', BA: 'BAM', BW: 'BWP',
    BR: 'BRL', BN: 'BND', BG: 'BGN', BF: 'XOF', BI: 'BIF', CV: 'CVE', KH: 'KHR', CM: 'XAF', CA: 'CAD',
    KY: 'KYD', CF: 'XAF', TD: 'XAF', CL: 'CLP', CN: 'CNY', CO: 'COP', KM: 'KMF', CG: 'XAF', CD: 'CDF',
    CR: 'CRC', HR: 'HRK', CU: 'CUP', CY: 'EUR', CZ: 'CZK', DK: 'DKK', DJ: 'DJF', DM: 'XCD', DO: 'DOP',
    EC: 'USD', EG: 'EGP', SV: 'USD', GQ: 'XAF', ER: 'ERN', EE: 'EUR', SZ: 'SZL', ET: 'ETB', FJ: 'FJD',
    FI: 'EUR', FR: 'EUR', GA: 'XAF', GM: 'GMD', GE: 'GEL', DE: 'EUR', GH: 'GHS', GI: 'GIP', GR: 'EUR',
    GL: 'DKK', GD: 'XCD', GU: 'USD', GT: 'GTQ', GN: 'GNF', GW: 'XOF', GY: 'GYD', HT: 'HTG', HN: 'HNL',
    HK: 'HKD', HU: 'HUF', IS: 'ISK', IN: 'INR', ID: 'IDR', IR: 'IRR', IQ: 'IQD', IE: 'EUR', IL: 'ILS',
    IT: 'EUR', JM: 'JMD', JP: 'JPY', JO: 'JOD', KZ: 'KZT', KE: 'KES', KI: 'AUD', KP: 'KPW', KR: 'KRW',
    KW: 'KWD', KG: 'KGS', LA: 'LAK', LV: 'EUR', LB: 'LBP', LS: 'LSL', LR: 'LRD', LY: 'LYD', LI: 'CHF',
    LT: 'EUR', LU: 'EUR', MO: 'MOP', MG: 'MGA', MW: 'MWK', MY: 'MYR', MV: 'MVR', ML: 'XOF', MT: 'EUR',
    MH: 'USD', MR: 'MRU', MU: 'MUR', MX: 'MXN', FM: 'USD', MD: 'MDL', MC: 'EUR', MN: 'MNT', ME: 'EUR',
    MA: 'MAD', MZ: 'MZN', MM: 'MMK', NA: 'NAD', NR: 'AUD', NP: 'NPR', NL: 'EUR', NZ: 'NZD', NI: 'NIO',
    NE: 'XOF', NG: 'NGN', MK: 'MKD', NO: 'NOK', OM: 'OMR', PK: 'PKR', PW: 'USD', PS: 'ILS', PA: 'PAB',
    PG: 'PGK', PY: 'PYG', PE: 'PEN', PH: 'PHP', PL: 'PLN', PT: 'EUR', PR: 'USD', QA: 'QAR', RO: 'RON',
    RU: 'RUB', RW: 'RWF', KN: 'XCD', LC: 'XCD', VC: 'XCD', WS: 'WST', SM: 'EUR', ST: 'STN', SA: 'SAR',
    SN: 'XOF', RS: 'RSD', SC: 'SCR', SL: 'SLL', SG: 'SGD', SK: 'EUR', SI: 'EUR', SB: 'SBD', SO: 'SOS',
    ZA: 'ZAR', SS: 'SSP', ES: 'EUR', LK: 'LKR', SD: 'SDG', SR: 'SRD', SE: 'SEK', CH: 'CHF', SY: 'SYP',
    TW: 'TWD', TJ: 'TJS', TZ: 'TZS', TH: 'THB', TL: 'USD', TG: 'XOF', TO: 'TOP', TT: 'TTD', TN: 'TND',
    TR: 'TRY', TM: 'TMT', TV: 'AUD', UG: 'UGX', UA: 'UAH', AE: 'AED', GB: 'GBP', US: 'USD', UY: 'UYU',
    UZ: 'UZS', VU: 'VUV', VE: 'VES', VN: 'VND', YE: 'YER', ZM: 'ZMW', ZW: 'ZWL'
  };

  private getCurrencyFromCountryCode(countryCode: string): string {
    return this.countryToCurrencyMap[countryCode.toUpperCase()] || 'USD'; // Default to USD if not found
  }

  async create(createUserDto: CreateUserDto): Promise<Partial<User>> {
    const existingUser = await this.userModel.findOne({ email: createUserDto.email }).exec();
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const currency = this.getCurrencyFromCountryCode(createUserDto.countryCode);

    try {
      const createdUser = new this.userModel({
        ...createUserDto,
        password: hashedPassword,
        currency, // Automatically set currency based on country code
      });
      const savedUser = await createdUser.save();
      return savedUser.toJSON();
    } catch (error) {
      throw new ConflictException('Error creating user');
    }
  }

  async findAll(): Promise<Partial<User>[]> {
    const users = await this.userModel.find().exec();
    return users.map(user => {
      const { password, ...result } = user.toObject();
      return result;
    });
  }

  async findById(id: string): Promise<Partial<User>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = user.toObject();
    return result;
  }

  async findByEmail(email: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ email })
      .select('+password') // Include password field
      .exec();
    
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    
    return user;
  }

  async update(id: string, updateUserDto: Partial<CreateUserDto>): Promise<Partial<User>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    if (updateUserDto.email) {
      const existingUser = await this.userModel.findOne({ 
        email: updateUserDto.email,
        _id: { $ne: id }
      }).exec();
      
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    if (updateUserDto.countryCode) {
      updateUserDto.currency = this.getCurrencyFromCountryCode(updateUserDto.countryCode); // Automatically set currency
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = updatedUser.toObject();
    return result;
  }

  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    const result = await this.userModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async deactivate(id: string): Promise<Partial<User>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = updatedUser.toObject();
    return result;
  }

  async activate(id: string): Promise<Partial<User>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { isActive: true }, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = updatedUser.toObject();
    return result;
  }

  async getUserCurrency(userId: string): Promise<{ currency: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return { currency: user.currency || 'USD' }; // Return the user's currency or a default value
  }
}
