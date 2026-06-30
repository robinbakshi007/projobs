// core/PlatformKernel.ts

class PlatformKernel {
  private services: Record<string, any> = {};

  public registerService(name: string, service: any): void {
    console.log(`[PlatformKernel] Registering service: ${name}`);
    this.services[name] = service;
  }

  public getService<T>(name: string): T {
    const service = this.services[name];
    if (!service) {
      throw new Error(`[PlatformKernel] Service not found: ${name}. Ensure it is registered during boot.`);
    }
    return service as T;
  }

  public getServiceNames(): string[] {
    return Object.keys(this.services);
  }
}

export const platformKernel = new PlatformKernel();
export default platformKernel;
